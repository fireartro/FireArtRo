import asyncio
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import AutoReconnect
import pytest

from auth import require_admin_session
from cookie_consent import ConsentGrant, MongoConsentLedger, create_consent_router
from test_auth import MemoryCollection, password_hash, server_client, server_loader


ORIGIN = {"Origin": "https://fireart.test"}
START = datetime(2026, 11, 22, 19, 21, 7, tzinfo=timezone.utc)


class ConsentCollection(MemoryCollection):
    async def create_index(self, field, **options):
        self.index = (field, options)


class RateLimiter:
    async def enforce(self, ip):
        assert ip


@pytest.fixture
def domain():
    clock = SimpleNamespace(now=START)
    collection = ConsentCollection()
    ledger = MongoConsentLedger(collection, clock=lambda: clock.now)
    app = FastAPI()
    app.include_router(create_consent_router(ledger, RateLimiter(), RateLimiter()))
    with TestClient(app, base_url="https://fireart.test") as client:
        yield SimpleNamespace(client=client, app=app, collection=collection, clock=clock)


def grant_data(**changes):
    return {
        "id": str(uuid4()),
        "withdrawKey": str(uuid4()),
        "version": 3,
        "analytics": True,
        "marketing": False,
        "retentionDays": 180,
        "contentRevision": "notice-revision-2026-11-22",
        "method": "preferences",
        **changes,
    }


def grant_reference(grant):
    return {key: grant[key] for key in ("id", "withdrawKey")}


def test_receipt_fixes_server_time_and_retries_preserve_it(domain):
    grant = grant_data()
    first = domain.client.post("/api/consent", json=grant, headers=ORIGIN)
    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    assert set(first.json()) == {
        "id", "version", "analytics", "marketing", "savedAt", "expiresAt", "contentRevision", "method",
    }
    assert first.json()["id"] == grant["id"]
    assert first.json()["contentRevision"] == grant["contentRevision"]
    assert first.json()["method"] == grant["method"]
    assert datetime.fromisoformat(first.json()["savedAt"]) == START
    assert datetime.fromisoformat(first.json()["expiresAt"]) == START + timedelta(days=180)
    document = domain.collection.documents[0]
    assert document["delete_after"] == START + timedelta(days=545)
    assert set(document) == {
        "_id", "version", "analytics", "marketing", "retention_days",
        "saved_at", "expires_at", "withdrawn_at", "delete_after", "content_revision", "method", "withdraw_key_hash",
    }
    assert document["withdraw_key_hash"] == sha256(UUID(grant["withdrawKey"]).bytes).hexdigest()
    assert grant["withdrawKey"] not in repr(document)
    domain.clock.now += timedelta(minutes=2)
    retry = domain.client.post("/api/consent", json=grant, headers=ORIGIN)
    assert retry.json() == first.json()
    assert len(domain.collection.documents) == 1
    for changed in ({"marketing": True}, {"method": "accept_all", "marketing": True}, {"contentRevision": None}, {"withdrawKey": str(uuid4())}):
        assert domain.client.post("/api/consent", json={**grant, **changed}, headers=ORIGIN).status_code == 409


def test_withdrawal_updates_only_once_and_receipt_lookup_requires_admin(domain):
    grant = grant_data()
    assert domain.client.post("/api/consent", json=grant, headers=ORIGIN).status_code == 200
    admin_url = f"/api/admin/consent/{grant['id']}"
    assert domain.client.get(admin_url).status_code in {401, 503}
    domain.app.dependency_overrides[require_admin_session] = lambda: object()
    before = domain.client.get(admin_url)
    assert before.status_code == 200
    assert before.json()["status"] == "active"
    assert before.headers["cache-control"] == "no-store"
    domain.clock.now = START + timedelta(days=1)
    wrong_reference = {**grant_reference(grant), "withdrawKey": str(uuid4())}
    denied = domain.client.post("/api/consent/withdraw", json=wrong_reference, headers=ORIGIN)
    assert denied.status_code == 409
    assert domain.client.get(admin_url).json()["status"] == "active"
    assert domain.client.post("/api/consent/withdraw", json=grant_reference(grant), headers=ORIGIN).status_code == 204
    domain.clock.now += timedelta(minutes=5)
    assert domain.client.post("/api/consent/withdraw", json=grant_reference(grant), headers=ORIGIN).status_code == 204
    after = domain.client.get(admin_url).json()
    assert after["status"] == "withdrawn"
    assert "withdrawKey" not in after and "withdraw_key_hash" not in after
    assert datetime.fromisoformat(after["withdrawnAt"]) == START + timedelta(days=1)
    assert datetime.fromisoformat(after["deleteAfter"]) == START + timedelta(days=366)
    assert domain.client.post("/api/consent", json=grant, headers=ORIGIN).status_code == 409


def test_withdrawal_before_grant_prevents_a_delayed_grant(domain):
    grant = grant_data()
    assert domain.client.post("/api/consent/withdraw", json=grant_reference(grant), headers=ORIGIN).status_code == 204
    wrong_reference = {**grant_reference(grant), "withdrawKey": str(uuid4())}
    assert domain.client.post("/api/consent/withdraw", json=wrong_reference, headers=ORIGIN).status_code == 409
    assert domain.client.post("/api/consent", json=grant, headers=ORIGIN).status_code == 409
    domain.app.dependency_overrides[require_admin_session] = lambda: object()
    assert domain.client.get(f"/api/admin/consent/{grant['id']}").status_code == 404
    assert domain.collection.documents[0]["delete_after"] == START + timedelta(days=1)


def test_expired_receipt_can_be_looked_up_during_the_evidence_period(domain):
    grant = grant_data(retentionDays=1)
    assert domain.client.post("/api/consent", json=grant, headers=ORIGIN).status_code == 200
    domain.app.dependency_overrides[require_admin_session] = lambda: object()
    admin_url = f"/api/admin/consent/{grant['id']}"
    domain.clock.now = START + timedelta(days=1)
    assert domain.client.get(admin_url).json()["status"] == "expired"
    assert domain.client.post("/api/consent", json=grant, headers=ORIGIN).status_code == 409
    domain.clock.now = START + timedelta(days=366)
    assert domain.client.get(admin_url).status_code == 404


@pytest.mark.parametrize(
    "changes",
    [
        {"version": 2}, {"version": 3.0}, {"analytics": "true"},
        {"analytics": False}, {"retentionDays": 731},
        {"retentionDays": "180"}, {"id": "invalid"},
        {"contentRevision": "invalid-revision/"}, {"method": "accept_all"},
        {"method": "submit"}, {"method": None}, {"withdrawKey": None},
        {"unrecognized": "synthetic-private-value"},
    ],
)
def test_invalid_requests_are_rejected_without_recording_or_echoing_input(domain, changes):
    result = domain.client.post("/api/consent", json=grant_data(**changes), headers=ORIGIN)
    assert result.status_code == 422
    assert "synthetic-private-value" not in result.text
    assert domain.collection.documents == []


@pytest.mark.parametrize("headers", [{}, {"Origin": "https://other.test"}])
def test_public_write_needs_same_origin(domain, headers):
    assert domain.client.post("/api/consent", json=grant_data(), headers=headers).status_code == 403
    assert domain.collection.documents == []


def test_storage_failure_cannot_issue_a_grant(domain, monkeypatch):
    async def unavailable(_document):
        raise AutoReconnect("contains private provider details")
    monkeypatch.setattr(domain.collection, "insert_one", unavailable)
    result = domain.client.post("/api/consent", json=grant_data(), headers=ORIGIN)
    assert result.status_code == 503
    assert "provider details" not in result.text


@pytest.mark.asyncio
async def test_withdrawal_racing_with_a_grant_leaves_no_active_record():
    collection = ConsentCollection()
    ledger = MongoConsentLedger(collection)
    choice = ConsentGrant.model_validate(grant_data())
    await asyncio.gather(ledger.grant(choice), ledger.withdraw(choice), return_exceptions=True)
    assert len(collection.documents) == 1
    assert collection.documents[0]["withdrawn_at"] is not None


@pytest.mark.asyncio
async def test_mounted_router_is_bounded_and_fails_closed_when_unavailable(server_loader):
    server = server_loader()
    async with server_client(server) as client:
        valid = await client.post("/api/consent", json=grant_data(), headers=ORIGIN)
        assert valid.status_code == 503
        assert valid.headers["cache-control"] == "no-store"
        oversized = await client.post(
            "/api/consent", json=grant_data(unexpected=" " * 512), headers=ORIGIN
        )
        assert oversized.status_code == 413
        assert oversized.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_index_matches_the_evidence_expiry():
    collection = ConsentCollection()
    await MongoConsentLedger(collection).create_indexes()
    assert collection.index == ("delete_after", {"expireAfterSeconds": 0})


@pytest.mark.asyncio
async def test_consent_index_failure_preserves_core_health(server_loader, monkeypatch):
    server = server_loader(
        MONGODB_URI="mongodb://127.0.0.1:27183",
        DB_NAME="fireartro_consent_index_test",
    )

    async def ready(*args, **kwargs):
        return {"ok": 1}

    async def unavailable():
        raise AutoReconnect("private consent collection error")

    collections = ["blog_posts", "admin_sessions", "admin_login_attempts"]
    monkeypatch.setattr(server, "db", SimpleNamespace(
        **{name: SimpleNamespace(create_index=ready) for name in collections},
        command=ready,
    ))
    for repository in (
        server.cms_repository, server.quote_repository, server.quote_delivery_repository,
        server.inbound_repository, server.inbound_reply_repository, server.quote_rate_limiter,
        server.consent_grant_limit, server.reviews_budget, server.media_repository,
    ):
        monkeypatch.setattr(repository, "create_indexes", ready)
    monkeypatch.setattr(server.consent_ledger, "create_indexes", unavailable)

    async with server.app.router.lifespan_context(server.app):
        async with server_client(server) as client:
            assert (await client.get("/api/health")).status_code == 200
            await server.require_auth_ready()
            denied = await client.post("/api/consent", json=grant_data(), headers=ORIGIN)
            assert denied.status_code == 503
            assert "private consent collection error" not in denied.text
