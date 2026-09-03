"""Quote administration contracts with isolated, atomic Mongo boundary doubles."""

import asyncio
import re
from copy import deepcopy
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import ReturnDocument
from pymongo.errors import AutoReconnect, DuplicateKeyError

from auth import ADMIN_COOKIE_NAME
from test_cms_routes import RouteAuthService, SESSION_TOKEN, CSRF_TOKEN


def quote(identifier="q1", **changes):
    return {
        "id": identifier, "first_name": "Ana", "last_name": "Popescu",
        "phone": "+40712345678", "email": "ana@example.com", "locality": "Cluj",
        "event_location": "Sala", "event_type": "Nuntă", "event_date": "2027-06-12",
        "services": ["Drone"], "package_title": "Signature", "package_id": "signature",
        "message": "Mesaj client", "created_at": "2026-09-03T12:00:00+00:00",
        "status": "new", "internal_note": "Notă privată", "consent": True,
        "unrelated_secret": "must-not-leak", **changes,
    }


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, branch) for branch in expected):
                return False
        elif isinstance(expected, dict):
            if "$regex" in expected:
                assert set(expected) == {"$regex", "$options"}
                if not re.search(expected["$regex"], document.get(key, ""), re.I):
                    return False
            elif "$exists" in expected:
                assert set(expected) == {"$exists"}
                if (key in document) != expected["$exists"]:
                    return False
            else:
                raise AssertionError(f"Unsupported operator {expected}")
        elif document.get(key) != expected:
            return False
    return True


def project(document, projection):
    if document is None:
        return None
    return deepcopy({key: value for key, value in document.items() if projection.get(key) == 1})


class Cursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, fields):
        for field, direction in reversed(fields):
            self.documents.sort(key=lambda d: d[field], reverse=direction == -1)
        return self

    def skip(self, count):
        self.documents = self.documents[count:]
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    def max_time_ms(self, milliseconds):
        assert 0 < milliseconds <= 2000
        return self

    async def to_list(self, length):
        await asyncio.sleep(0)
        return deepcopy(self.documents[:length])


class Collection:
    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))
        self.indexes = []

    def find(self, query, projection):
        return Cursor([project(d, projection) for d in self.documents if matches(d, query)])

    async def count_documents(self, query, **kwargs):
        assert kwargs.get("maxTimeMS", 0) > 0
        return sum(matches(d, query) for d in self.documents)

    async def find_one(self, query, projection):
        await asyncio.sleep(0)
        return project(next((d for d in self.documents if matches(d, query)), None), projection)

    async def find_one_and_update(self, query, update, *, return_document, projection=None, upsert=False):
        await asyncio.sleep(0)  # concurrency before the atomic storage operation
        assert return_document == ReturnDocument.AFTER
        assert not set(update) - {"$set", "$inc", "$setOnInsert"}
        document = next((d for d in self.documents if matches(d, query)), None)
        if document is None and upsert:
            document = {**query, **deepcopy(update.get("$setOnInsert", {}))}
            self.documents.append(document)
        if document is None:
            return None
        document.update(deepcopy(update.get("$set", {})))
        for key, amount in update.get("$inc", {}).items():
            document[key] = document.get(key, 0) + amount
        return project(document, projection) if projection else deepcopy(document)

    async def create_index(self, keys, **kwargs):
        self.indexes.append((keys, kwargs))


@pytest.fixture
def domain():
    # Import inside the fixture so the initial red run is an explicit missing-feature assertion.
    import importlib.util
    assert importlib.util.find_spec("quote_admin"), "Protected quote administration is missing"
    from quote_admin import MongoQuoteRepository, create_quote_admin_router
    collection = Collection([quote(), quote("q2", first_name="Ion", locality="Brașov")])
    repository = MongoQuoteRepository(collection)
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_quote_admin_router(repository))
    with TestClient(app) as client:
        yield client, collection, repository


def authorize(client):
    client.cookies.set(ADMIN_COOKIE_NAME, SESSION_TOKEN)
    return {"X-CSRF-Token": CSRF_TOKEN, "Origin": "http://testserver"}


def test_all_quote_routes_require_session_and_mutations_require_csrf(domain):
    client, collection, _ = domain
    before = deepcopy(collection.documents)
    assert client.get("/api/admin/quotes", headers={"X-Admin-Key": "old-key"}).status_code == 401
    assert client.get("/api/admin/quotes/q1").status_code == 401
    assert client.patch("/api/admin/quotes/q1", json={"version": 0, "status": "spam"}).status_code == 401
    authorize(client)
    assert client.patch("/api/admin/quotes/q1", json={"version": 0, "status": "spam"}).status_code == 403
    assert client.patch("/api/admin/quotes/q1", json={"version": 0, "status": "spam"},
                        headers={"X-CSRF-Token": CSRF_TOKEN, "Origin": "https://evil.example"}).status_code == 403
    assert collection.documents == before


def test_filters_pagination_and_summary_do_not_expose_notes_or_contact_details(domain):
    client, _, _ = domain
    authorize(client)
    response = client.get("/api/admin/quotes?status=new&q=cluj&page_size=1")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == "q1"
    for private in ("internal_note", "Notă privată", "phone", "email", "message", "unrelated_secret"):
        assert private not in response.text
    first = client.get("/api/admin/quotes?page_size=1").json()
    second = client.get("/api/admin/quotes?page_size=1&page=2").json()
    assert [first["items"][0]["id"], second["items"][0]["id"]] == ["q2", "q1"]
    assert first["total"] == second["total"] == 2
    assert client.get("/api/admin/quotes?page=3&page_size=1").json()["items"] == []


@pytest.mark.parametrize("query", [".*", "(a+)+$", "{\"$ne\":null}", "Notă privată"])
def test_search_is_literal_and_never_searches_private_notes(domain, query):
    client, _, _ = domain
    authorize(client)
    assert client.get("/api/admin/quotes", params={"q": query}).json()["items"] == []


@pytest.mark.parametrize("query", ["status=deleted", "page=0", "page=1001", "page_size=0", "page_size=101", "q=" + "x" * 121])
def test_filter_bounds_are_authoritative(domain, query):
    client, _, _ = domain
    authorize(client)
    assert client.get("/api/admin/quotes?" + query).status_code == 422


def test_detail_update_and_stale_version_never_overwrite_newer_note(domain):
    client, collection, _ = domain
    headers = authorize(client)
    detail = client.get("/api/admin/quotes/q1")
    assert detail.json()["internal_note"] == "Notă privată"
    assert detail.json()["version"] == 0
    assert "must-not-leak" not in detail.text
    saved = client.patch("/api/admin/quotes/q1", json={"version": 0, "status": "contacted", "internal_note": "Sunat\nRevenim mâine"}, headers=headers)
    assert saved.status_code == 200
    assert saved.json()["version"] == 1
    assert saved.json()["status"] == "contacted"
    assert saved.headers["cache-control"] == "no-store"
    stale = client.patch("/api/admin/quotes/q1", json={"version": 0, "internal_note": "Overwrite"}, headers=headers)
    assert stale.status_code == 409
    assert collection.documents[0]["internal_note"] == "Sunat\nRevenim mâine"
    saved = client.patch("/api/admin/quotes/q1", json={"version": 1, "status": "qualified"}, headers=headers)
    assert saved.json()["internal_note"] == "Sunat\nRevenim mâine"
    assert saved.json()["version"] == 2
    assert client.get("/api/quotes/q1").status_code == 404
    assert client.get("/api/quotes").status_code == 404


@pytest.mark.parametrize("payload", [
    {"version": 0, "status": "deleted"}, {"version": 0, "internal_note": "x" * 4001},
    {"version": -1, "status": "new"}, {"version": True, "status": "new"},
    {"version": "0", "status": "new"}, {"status": "new"}, {"version": 0},
    {"version": 0, "internal_note": None}, {"version": 0, "status": None},
    {"version": 0, "status": "new", "email": "changed@example.com"},
])
def test_invalid_mutations_do_not_change_customer_data(domain, payload):
    client, collection, _ = domain
    before = deepcopy(collection.documents)
    response = client.patch("/api/admin/quotes/q1", json=payload, headers=authorize(client))
    assert response.status_code == 422
    assert collection.documents == before
    assert "x" * 100 not in response.text  # validation errors do not echo private input


def test_missing_quote_and_database_failure_are_sanitized(domain, monkeypatch):
    client, _, repository = domain
    headers = authorize(client)
    assert client.get("/api/admin/quotes/absent").status_code == 404
    assert client.patch("/api/admin/quotes/absent", json={"version": 0, "status": "closed"}, headers=headers).status_code == 404

    async def broken(*args, **kwargs):
        raise AutoReconnect("mongodb://private:password@example.com")

    monkeypatch.setattr(repository.collection, "find_one", broken)
    failure = client.get("/api/admin/quotes/q1")
    assert failure.status_code == 503
    assert "password" not in failure.text


@pytest.mark.asyncio
async def test_concurrent_editors_get_one_success_and_one_conflict():
    from quote_admin import MongoQuoteRepository, QuoteAdminUpdate
    from fastapi import HTTPException
    collection = Collection([quote()])
    a, b = MongoQuoteRepository(collection), MongoQuoteRepository(collection)
    outcomes = await asyncio.gather(
        a.update("q1", QuoteAdminUpdate(version=0, internal_note="Editor A")),
        b.update("q1", QuoteAdminUpdate(version=0, internal_note="Editor B")),
        return_exceptions=True,
    )
    assert sum(isinstance(result, HTTPException) and result.status_code == 409 for result in outcomes) == 1
    assert collection.documents[0]["version"] == 1
    assert collection.documents[0]["internal_note"] in {"Editor A", "Editor B"}


@pytest.mark.asyncio
async def test_rate_limit_is_atomic_across_instances_and_rolls_over_without_ttl_cleanup():
    from quote_admin import MongoQuoteRateLimiter
    from fastapi import HTTPException
    collection = Collection()
    instant = datetime(2026, 9, 3, 12, tzinfo=timezone.utc)
    limiters = [MongoQuoteRateLimiter(collection, "isolated-test-secret", clock=lambda: instant) for _ in range(2)]
    outcomes = await asyncio.gather(*(limiters[i % 2].enforce("127.0.0.1") for i in range(12)), return_exceptions=True)
    assert sum(result is None for result in outcomes) == 5
    assert all(result is None or isinstance(result, HTTPException) and result.status_code == 429 for result in outcomes)
    assert "127.0.0.1" not in repr(collection.documents)
    assert collection.documents[0]["expires_at"].tzinfo is not None
    instant = datetime(2026, 9, 3, 12, 10, tzinfo=timezone.utc)
    await limiters[0].enforce("127.0.0.1")
    assert len(collection.documents) == 2
    await limiters[0].create_indexes()
    assert ("expires_at", {"expireAfterSeconds": 0}) in collection.indexes


@pytest.mark.asyncio
async def test_rate_limit_first_upsert_collision_retries_increment(monkeypatch):
    from quote_admin import MongoQuoteRateLimiter
    collection = Collection()
    original = collection.find_one_and_update
    raced = False

    async def collide(query, update, **kwargs):
        nonlocal raced
        if not raced:
            raced = True
            await original(query, update, **kwargs)
            raise DuplicateKeyError("simulated other instance created window")
        return await original(query, update, **kwargs)

    monkeypatch.setattr(collection, "find_one_and_update", collide)
    await MongoQuoteRateLimiter(collection, "isolated-test-secret").enforce("127.0.0.1")
    assert collection.documents[0]["count"] == 2
