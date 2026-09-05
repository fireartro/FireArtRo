"""Admin security contracts; all storage and HTTP traffic stay in-process."""

import asyncio
import hashlib
import hmac
import importlib.util
import os
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import bcrypt
import httpx
import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import AutoReconnect, DuplicateKeyError

from auth import (
    ADMIN_COOKIE_NAME,
    AuthError,
    AuthService,
    MongoLoginAttemptRepository,
    MongoSessionRepository,
    create_auth_router,
    require_admin_session,
)


class MemoryCollection:
    """Mongo boundary double: unique _id, atomic CAS and detached BSON-like data.

    Each operation yields before its atomic section to expose read/write races.
    Unknown query/update operators fail instead of silently accepting bad queries.
    """

    def __init__(self):
        self.documents = []

    @staticmethod
    def matches(document, query):
        for key, expected in query.items():
            actual = document.get(key)
            if isinstance(expected, dict):
                for operator, value in expected.items():
                    if operator == "$gt":
                        if isinstance(actual, datetime) and actual.tzinfo is None:
                            actual = actual.replace(tzinfo=timezone.utc)
                        if actual is None or actual <= value:
                            return False
                    else:
                        raise AssertionError(f"Unsupported query operator {operator}")
            elif actual != expected:
                return False
        return True

    async def find_one(self, query):
        await asyncio.sleep(0)
        return deepcopy(
            next((d for d in self.documents if self.matches(d, query)), None)
        )

    async def insert_one(self, document):
        await asyncio.sleep(0)
        if any(d["_id"] == document["_id"] for d in self.documents):
            raise DuplicateKeyError("duplicate _id")
        self.documents.append(deepcopy(document))
        return SimpleNamespace(inserted_id=document["_id"])

    async def replace_one(self, query, replacement):
        await asyncio.sleep(0)
        for index, document in enumerate(self.documents):
            if self.matches(document, query):
                assert replacement["_id"] == document["_id"]
                self.documents[index] = deepcopy(replacement)
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def update_one(self, query, update):
        await asyncio.sleep(0)
        assert set(update) == {"$set"}
        for document in self.documents:
            if self.matches(document, query):
                document.update(deepcopy(update["$set"]))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)


class Clock:
    def __init__(self):
        self.now = datetime(2026, 9, 3, 12, tzinfo=timezone.utc)

    def __call__(self):
        return self.now


@pytest.fixture(scope="module")
def password_hash():
    return bcrypt.hashpw(b"correct horse", bcrypt.gensalt(rounds=4)).decode("ascii")


@pytest.fixture
def domain(password_hash, monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    sessions, attempts, clock = MemoryCollection(), MemoryCollection(), Clock()

    def service(**overrides):
        values = dict(
            sessions=MongoSessionRepository(sessions),
            attempts=MongoLoginAttemptRepository(attempts),
            username="admin",
            password_hash=password_hash,
            session_secret="test-session-secret-with-at-least-32-bytes",
            clock=clock,
        )
        values.update(overrides)
        return AuthService(**values)

    return SimpleNamespace(
        sessions=sessions,
        attempts=attempts,
        clock=clock,
        service=service,
        auth=service(),
    )


async def login(service, password="correct horse", username="admin", ip="127.0.0.1"):
    return await service.login(username, password, ip, "pytest")


@pytest.mark.asyncio
async def test_login_creates_only_hashed_twelve_hour_session(domain):
    issued = await login(domain.auth)
    document = domain.sessions.documents[0]
    assert len(issued.raw_token) == 64
    assert len(issued.csrf_token) >= 43
    assert (
        document["token_hash"]
        == hmac.new(
            b"test-session-secret-with-at-least-32-bytes",
            issued.raw_token.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
    )
    assert (
        document["csrf_hash"]
        == hmac.new(
            b"test-session-secret-with-at-least-32-bytes",
            issued.csrf_token.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
    )
    assert issued.raw_token not in repr(document)
    assert issued.csrf_token not in repr(document)
    assert document["created_at"] == domain.clock.now
    assert document["expires_at"] == domain.clock.now + timedelta(hours=12)
    assert issued.expires_at == document["expires_at"]
    assert document["revoked_at"] is None
    assert "127.0.0.1" not in repr(domain.attempts.documents)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "username,password", [("admin", "wrong"), ("wrong", "correct horse")]
)
async def test_invalid_credentials_never_create_session(domain, username, password):
    with pytest.raises(AuthError) as error:
        await login(domain.auth, username=username, password=password)
    assert error.value.status_code == 401
    assert error.value.detail == "Datele de autentificare nu sunt valide."
    assert domain.sessions.documents == []


@pytest.mark.asyncio
async def test_refresh_restores_same_csrf_across_instances_without_rotating_tabs(
    domain,
):
    issued = await login(domain.auth)
    before = deepcopy(domain.sessions.documents)
    first = await domain.auth.authenticate(issued.raw_token)
    second = await domain.service().authenticate(issued.raw_token)
    assert first.username == "admin"
    assert first.csrf_token == second.csrf_token == issued.csrf_token
    domain.auth.verify_csrf(first, issued.csrf_token)
    domain.auth.verify_csrf(second, first.csrf_token)
    assert domain.sessions.documents == before


@pytest.mark.asyncio
async def test_separate_sessions_have_independent_tokens_and_csrf(domain):
    first, second = await login(domain.auth), await login(domain.auth)
    assert first.raw_token != second.raw_token
    assert first.csrf_token != second.csrf_token
    identity = await domain.auth.authenticate(first.raw_token)
    with pytest.raises(AuthError) as error:
        domain.auth.verify_csrf(identity, second.csrf_token)
    assert error.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("csrf", ["", "wrong", "é" * 43, "\ud800", None])
async def test_csrf_rejects_missing_mismatched_and_invalid_utf8(domain, csrf):
    issued = await login(domain.auth)
    identity = await domain.auth.authenticate(issued.raw_token)
    with pytest.raises(AuthError) as error:
        domain.auth.verify_csrf(identity, csrf)
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_expiry_is_enforced_at_twelve_hours_without_ttl_cleanup(domain):
    issued = await login(domain.auth)
    domain.clock.now += timedelta(hours=12) - timedelta(microseconds=1)
    await domain.auth.authenticate(issued.raw_token)
    domain.clock.now += timedelta(microseconds=1)
    with pytest.raises(AuthError) as error:
        await domain.auth.authenticate(issued.raw_token)
    assert error.value.status_code == 401
    assert len(domain.sessions.documents) == 1


@pytest.mark.asyncio
async def test_mongo_naive_utc_dates_authenticate_correctly(domain):
    issued = await login(domain.auth)
    domain.sessions.documents[0]["expires_at"] = issued.expires_at.replace(tzinfo=None)
    assert (
        await domain.auth.authenticate(issued.raw_token)
    ).expires_at == issued.expires_at


@pytest.mark.asyncio
async def test_logout_revokes_only_its_session_and_is_idempotent(domain):
    first, second = await login(domain.auth), await login(domain.auth)
    await domain.service().logout(first.raw_token)
    await domain.auth.logout(first.raw_token)
    assert domain.sessions.documents[0]["revoked_at"] == domain.clock.now
    with pytest.raises(AuthError):
        await domain.auth.authenticate(first.raw_token)
    await domain.auth.authenticate(second.raw_token)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token", ["", "unknown", "a" * 64, "é" * 64, "\ud800", None, "x" * 5000]
)
async def test_missing_unknown_and_malformed_sessions_are_unauthorized(domain, token):
    with pytest.raises(AuthError) as error:
        await domain.auth.authenticate(token)
    assert error.value.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value,config_name",
    [
        ("username", "", "ADMIN_USERNAME"),
        ("username", "\ud800", "ADMIN_USERNAME"),
        ("password_hash", "", "ADMIN_PASSWORD_HASH"),
        ("password_hash", "not-a-bcrypt-hash", "ADMIN_PASSWORD_HASH"),
        ("password_hash", "$2b$31$" + "a" * 53, "ADMIN_PASSWORD_HASH"),
        ("session_secret", "", "ADMIN_SESSION_SECRET"),
        ("session_secret", "too-short", "ADMIN_SESSION_SECRET"),
        ("session_secret", "\ud800" * 32, "ADMIN_SESSION_SECRET"),
    ],
)
async def test_bad_configuration_disables_auth_without_blocking_app_creation(
    domain, field, value, config_name
):
    service = domain.service(**{field: value})
    assert config_name in service.configuration_errors
    for operation in [
        login(service),
        service.authenticate("a" * 64),
        service.logout("a" * 64),
    ]:
        with pytest.raises(AuthError) as error:
            await operation
        assert error.value.status_code == 503
        assert value == "" or value not in error.value.detail
    assert domain.sessions.documents == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "username,password",
    [
        ("\ud800", "correct horse"),
        ("a" * 257, "correct horse"),
        ("admin", "\ud800"),
        ("admin", "é" * 37),
        ("admin", "x" * 73),
        ("admin", ""),
        (None, "correct horse"),
        ("admin", None),
    ],
)
async def test_bad_utf8_types_and_bcrypt_byte_lengths_have_generic_errors(
    domain, username, password
):
    with pytest.raises(AuthError) as error:
        await login(domain.auth, username=username, password=password)
    assert error.value.status_code == 401
    assert error.value.detail == "Datele de autentificare nu sunt valide."


@pytest.mark.asyncio
async def test_unicode_credentials_and_exact_72_byte_password_are_supported(domain):
    password = "é" * 36
    hashed = bcrypt.hashpw(password.encode("utf8"), bcrypt.gensalt(rounds=4)).decode(
        "ascii"
    )
    service = domain.service(username="șef", password_hash=hashed)
    issued = await login(service, username="șef", password=password)
    assert (await service.authenticate(issued.raw_token)).username == "șef"
    with pytest.raises(AuthError):
        await login(service, username="șef", password=password + "x")


@pytest.mark.asyncio
async def test_five_failures_block_even_correct_password_across_instances(domain):
    for _ in range(5):
        with pytest.raises(AuthError) as error:
            await login(domain.service(), password="wrong")
        assert error.value.status_code == 401
    with pytest.raises(AuthError) as error:
        await login(domain.service())
    assert error.value.status_code == 429
    assert int(error.value.headers["Retry-After"]) == 600
    assert domain.sessions.documents == []
    await login(domain.auth, ip="127.0.0.2")


@pytest.mark.asyncio
async def test_throttle_uses_rolling_ten_minutes_and_ignores_delayed_ttl(domain):
    with pytest.raises(AuthError):
        await login(domain.auth, password="wrong")
    domain.clock.now += timedelta(minutes=9)
    for _ in range(4):
        with pytest.raises(AuthError):
            await login(domain.auth, password="wrong")
    domain.clock.now += timedelta(minutes=1)
    with pytest.raises(AuthError) as error:
        await login(domain.auth, password="wrong")
    assert error.value.status_code == 401  # oldest reservation just expired
    with pytest.raises(AuthError) as error:
        await login(domain.auth)
    assert error.value.status_code == 429  # four recent failures survived boundary
    domain.clock.now += timedelta(minutes=10)
    await login(domain.service())


@pytest.mark.asyncio
async def test_success_clears_completed_failures(domain):
    for _ in range(4):
        with pytest.raises(AuthError):
            await login(domain.auth, password="wrong")
    await login(domain.auth)
    for _ in range(5):
        with pytest.raises(AuthError) as error:
            await login(domain.auth, password="wrong")
        assert error.value.status_code == 401
    with pytest.raises(AuthError) as error:
        await login(domain.auth)
    assert error.value.status_code == 429


@pytest.mark.asyncio
async def test_concurrent_failed_logins_cannot_bypass_five_attempt_budget(domain):
    outcomes = await asyncio.gather(
        *(login(domain.service(), password="wrong") for _ in range(30)),
        return_exceptions=True,
    )
    assert all(isinstance(result, AuthError) for result in outcomes)
    assert sorted(result.status_code for result in outcomes) == [401] * 5 + [429] * 25
    assert domain.sessions.documents == []
    assert len(domain.attempts.documents) == 1


@pytest.mark.asyncio
async def test_bcrypt_runs_off_event_loop_and_pending_attempts_are_reserved(
    domain, monkeypatch
):
    entered, release = threading.Event(), threading.Event()
    thread_ids = []
    original = bcrypt.checkpw

    def slow_check(password, hashed):
        thread_ids.append(threading.get_ident())
        entered.set()
        if not release.wait(timeout=2):
            raise AssertionError("bcrypt blocked the event loop")
        return original(password, hashed)

    monkeypatch.setattr(bcrypt, "checkpw", slow_check)
    pending = [
        asyncio.create_task(login(domain.service(), password="wrong")) for _ in range(5)
    ]
    try:
        for _ in range(100):
            if len(thread_ids) == 5:
                break
            await asyncio.sleep(0.001)
        assert entered.is_set()
        assert len(thread_ids) == 5
        assert threading.get_ident() not in thread_ids
        with pytest.raises(AuthError) as error:
            await login(domain.auth)
        assert error.value.status_code == 429
    finally:
        release.set()
        await asyncio.gather(*pending, return_exceptions=True)


@pytest.mark.asyncio
async def test_database_failure_cannot_issue_or_authenticate_session(
    domain, monkeypatch
):
    async def unavailable(*args, **kwargs):
        raise AutoReconnect("private database connection detail")

    monkeypatch.setattr(domain.attempts, "find_one", unavailable)
    with pytest.raises(AuthError) as error:
        await login(domain.auth)
    assert error.value.status_code == 503
    assert "private" not in error.value.detail
    assert domain.sessions.documents == []
    monkeypatch.setattr(domain.sessions, "find_one", unavailable)
    with pytest.raises(AuthError) as error:
        await domain.auth.authenticate("a" * 64)
    assert error.value.status_code == 503


def asgi_client(service, base_url="https://fireart.test"):
    app = FastAPI()
    app.state.auth_service = service
    app.include_router(create_auth_router(service))

    @app.api_route(
        "/api/admin/protected", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
    )
    async def protected(identity=Depends(require_admin_session)):
        return {"username": identity.username}

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=base_url)


@pytest.mark.asyncio
async def test_router_cookie_refresh_and_logout_contract(domain):
    async with asgi_client(domain.auth) as client:
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
        )
        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        for value in [
            "HttpOnly",
            "Secure",
            "SameSite=strict",
            "Path=/api/admin",
            "Max-Age=43200",
        ]:
            assert value in cookie
        assert "Domain=" not in cookie
        raw = client.cookies[ADMIN_COOKIE_NAME]
        csrf = response.json()["csrf_token"]
        assert raw not in response.text
        assert "token_hash" not in response.text
        assert response.headers["cache-control"] == "no-store"
        for _ in range(2):
            refreshed = await client.get("/api/admin/auth/session")
            assert refreshed.status_code == 200
            assert refreshed.json()["csrf_token"] == csrf
            assert refreshed.headers["cache-control"] == "no-store"
            assert "set-cookie" not in refreshed.headers
        assert (
            await client.post("/api/admin/protected", headers={"X-CSRF-Token": csrf})
        ).status_code == 200
        assert (await client.post("/api/admin/auth/logout")).status_code == 403
        logout = await client.post(
            "/api/admin/auth/logout", headers={"X-CSRF-Token": csrf}
        )
        assert logout.status_code == 200
        assert "Max-Age=0" in logout.headers["set-cookie"]
        assert "Path=/api/admin" in logout.headers["set-cookie"]
        assert logout.headers["cache-control"] == "no-store"
        assert (await client.get("/api/admin/auth/session")).status_code == 401
        with pytest.raises(AuthError):
            await domain.auth.authenticate(raw)


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.test",
        "http://fireart.test",
        "https://fireart.test:444",
        "null",
        "https://fireart.test/",
        "https://fireart.test@evil.test",
        "https://fireart.test?x=1",
    ],
)
async def test_mutations_reject_cross_origin_even_with_valid_csrf(
    domain, method, origin
):
    issued = await login(domain.auth)
    async with asgi_client(domain.auth) as client:
        client.cookies.set(ADMIN_COOKIE_NAME, issued.raw_token)
        response = await client.request(
            method,
            "/api/admin/protected",
            headers={"Origin": origin, "X-CSRF-Token": issued.csrf_token},
        )
        assert response.status_code == 403
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_same_origin_accepts_default_port_and_csrf_but_reads_need_only_cookie(
    domain,
):
    issued = await login(domain.auth)
    async with asgi_client(domain.auth) as client:
        client.cookies.set(ADMIN_COOKIE_NAME, issued.raw_token)
        assert (await client.get("/api/admin/protected")).status_code == 200
        assert (
            await client.post(
                "/api/admin/protected",
                headers={
                    "Origin": "https://fireart.test:443",
                    "X-CSRF-Token": issued.csrf_token,
                },
            )
        ).status_code == 200


@pytest.mark.asyncio
async def test_login_rejects_cross_origin_before_issuing_cookie(domain):
    async with asgi_client(domain.auth) as client:
        response = await client.post(
            "/api/admin/auth/login",
            headers={"Origin": "https://evil.test"},
            json={"username": "admin", "password": "correct horse"},
        )
        assert response.status_code == 403
        assert "set-cookie" not in response.headers
        assert domain.sessions.documents == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"username": "wrong", "password": "secret-input"},
        {"username": "admin", "password": "secret-input"},
        {"username": {}, "password": ["secret-input"]},
        {"password": "secret-input"},
        [],
    ],
)
async def test_router_invalid_credentials_have_generic_nonleaking_errors(
    domain, payload
):
    async with asgi_client(domain.auth) as client:
        response = await client.post("/api/admin/auth/login", json=payload)
        assert response.status_code == 401
        assert response.json() == {"detail": "Datele de autentificare nu sunt valide."}
        assert response.headers["cache-control"] == "no-store"
        assert "set-cookie" not in response.headers


@pytest.mark.asyncio
async def test_dependency_never_accepts_legacy_admin_key(domain):
    async with asgi_client(domain.auth) as client:
        response = await client.get(
            "/api/admin/protected", headers={"X-Admin-Key": "any-old-key"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("vercel", [None, "0", "true", "1"])
async def test_forwarded_client_ip_is_used_only_on_vercel(domain, monkeypatch, vercel):
    if vercel is not None:
        monkeypatch.setenv("VERCEL", vercel)
    async with asgi_client(domain.auth) as client:
        statuses = []
        for index in range(6):
            response = await client.post(
                "/api/admin/auth/login",
                json={"username": "admin", "password": "wrong"},
                headers={"X-Forwarded-For": f"192.0.2.{index + 1}"},
            )
            statuses.append(response.status_code)
        assert statuses == ([401] * 6 if vercel == "1" else [401] * 5 + [429])
        if vercel == "1":
            # Different workers may have the same internal peer; the platform IP
            # must provide a shared bucket for the same external client as well.
            for _ in range(4):
                await client.post(
                    "/api/admin/auth/login",
                    json={"username": "admin", "password": "wrong"},
                    headers={"X-Forwarded-For": "192.0.2.1"},
                )
            response = await client.post(
                "/api/admin/auth/login",
                json={"username": "admin", "password": "correct horse"},
                headers={"X-Forwarded-For": "192.0.2.1"},
            )
            assert response.status_code == 429


@pytest.mark.asyncio
@pytest.mark.parametrize("vercel,expected", [("1", 200), ("0", 403)])
async def test_public_https_origin_uses_vercel_proto_but_never_arbitrary_local_forwarding(
    domain, monkeypatch, vercel, expected
):
    monkeypatch.setenv("VERCEL", vercel)
    async with asgi_client(domain.auth, base_url="http://fireart.test") as client:
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
            headers={"Origin": "https://fireart.test", "X-Forwarded-Proto": "https"},
        )
        assert response.status_code == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("vercel", ["0", "1"])
async def test_forwarded_host_cannot_authorize_a_different_origin(
    domain, monkeypatch, vercel
):
    monkeypatch.setenv("VERCEL", vercel)
    async with asgi_client(domain.auth) as client:
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
            headers={
                "Origin": "https://evil.test",
                "X-Forwarded-Host": "evil.test",
                "Forwarded": "host=evil.test;proto=https",
            },
        )
        assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "origin",
    [
        "https://fireart.test:0",
        "https://fireart.test:",
        "https://fireart.test?",
        "https://fireart.test#",
        "https://fireart.\x00test",
        "https://fireart.\ttest",
    ],
)
async def test_origin_parser_rejects_invalid_serialized_origins(domain, origin):
    async with asgi_client(domain.auth) as client:
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
            headers={"Origin": origin},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_origin_and_cross_site_fetch_metadata_are_denied(domain):
    async with asgi_client(domain.auth) as client:
        for headers in [
            [("Origin", "https://fireart.test"), ("Origin", "https://evil.test")],
            {"Sec-Fetch-Site": "cross-site"},
            {"Sec-Fetch-Site": "same-site"},
        ]:
            response = await client.post(
                "/api/admin/auth/login",
                json={"username": "admin", "password": "correct horse"},
                headers=headers,
            )
            assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body,content_type",
    [
        (b'{"password":', "application/json"),
        (b"\xff", "application/json"),
        (b"username=admin&password=correct+horse", "application/x-www-form-urlencoded"),
        (b" " * 4097, "application/json"),
    ],
)
async def test_malformed_login_bodies_are_generic_and_throttled(
    domain, body, content_type
):
    async with asgi_client(domain.auth) as client:
        for _ in range(5):
            response = await client.post(
                "/api/admin/auth/login",
                content=body,
                headers={"Content-Type": content_type},
            )
            assert response.status_code == 401
            assert response.json() == {
                "detail": "Datele de autentificare nu sunt valide."
            }
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
        )
        assert response.status_code == 429


@pytest.mark.asyncio
async def test_invalid_bcrypt_salt_is_generic_and_cannot_issue_session(domain):
    service = domain.service(password_hash="$2b$04$" + "a" * 53)
    assert "ADMIN_PASSWORD_HASH" in service.configuration_errors
    with pytest.raises(AuthError) as error:
        await login(service)
    assert error.value.status_code == 503
    assert "$2b$" not in error.value.detail
    assert domain.sessions.documents == []


@pytest.mark.asyncio
async def test_success_never_erases_other_pending_reservations(domain):
    repository = MongoLoginAttemptRepository(domain.attempts)
    key = "controlled-ip-hmac"
    reservations = [await repository.reserve(key, domain.clock.now) for _ in range(5)]
    await repository.clear(key, reservations[0], domain.clock.now)
    await repository.reserve(key, domain.clock.now)
    with pytest.raises(AuthError) as error:
        await repository.reserve(key, domain.clock.now)
    assert error.value.status_code == 429
    for reservation in reservations[1:]:
        await repository.record_failure(key, reservation, domain.clock.now)
    with pytest.raises(AuthError) as error:
        await repository.reserve(key, domain.clock.now)
    assert error.value.status_code == 429


@pytest.mark.asyncio
async def test_csrf_hash_tampering_fails_closed_and_secret_rotation_invalidates_sessions(
    domain,
):
    issued = await login(domain.auth)
    rotated = domain.service(session_secret="a-different-secret-with-at-least-32-bytes")
    with pytest.raises(AuthError):
        await rotated.authenticate(issued.raw_token)
    domain.sessions.documents[0]["csrf_hash"] = "a" * 64
    with pytest.raises(AuthError):
        await domain.auth.authenticate(issued.raw_token)


@pytest_asyncio.fixture
async def real_mongo(domain):
    uri = os.environ.get("FIREART_AUTH_TEST_MONGO_URI")
    if not uri:
        pytest.skip(
            "Set FIREART_AUTH_TEST_MONGO_URI to the explicitly isolated replica set"
        )
    # Deliberately allow only the controller-authorized local target, never env DBs.
    assert uri == "mongodb://127.0.0.1:27183/?replicaSet=testset"
    database_name = "fireartro_cms_test_auth_" + uuid.uuid4().hex
    clients = [AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000) for _ in range(2)]
    try:
        assert (await clients[0].admin.command("hello"))["setName"] == "testset"
        database = clients[0][database_name]
        await database.admin_sessions.create_index("expires_at", expireAfterSeconds=0)
        await database.admin_sessions.create_index("token_hash", unique=True)
        await database.admin_login_attempts.create_index(
            "expires_at", expireAfterSeconds=0
        )
        domain.clock.now = datetime.now(timezone.utc).replace(microsecond=0)

        def service(index=0):
            db = clients[index][database_name]
            return domain.service(
                sessions=MongoSessionRepository(db.admin_sessions),
                attempts=MongoLoginAttemptRepository(db.admin_login_attempts),
            )

        yield SimpleNamespace(db=database, service=service, clock=domain.clock)
    finally:
        # Delete exactly the UUID database this fixture created, never a broad drop.
        assert database_name.startswith("fireartro_cms_test_auth_")
        assert len(database_name.removeprefix("fireartro_cms_test_auth_")) == 32
        await clients[0].drop_database(database_name)
        for client in clients:
            client.close()
        print(f"Removed disposable database {database_name}")


@pytest.mark.asyncio
async def test_real_mongo_concurrent_logins_share_five_attempt_budget(real_mongo):
    results = await asyncio.gather(
        *(
            login(real_mongo.service(index % 2), password="wrong")
            for index in range(30)
        ),
        return_exceptions=True,
    )
    assert all(isinstance(result, AuthError) for result in results)
    assert sorted(result.status_code for result in results) == [401] * 5 + [429] * 25
    assert await real_mongo.db.admin_sessions.count_documents({}) == 0
    assert await real_mongo.db.admin_login_attempts.count_documents({}) == 1
    with pytest.raises(AuthError) as error:
        await login(real_mongo.service(1))
    assert error.value.status_code == 429


@pytest.mark.asyncio
async def test_real_mongo_sessions_restore_csrf_revoke_and_expire_across_clients(
    real_mongo,
):
    first = await login(real_mongo.service())
    second = await login(real_mongo.service(1))
    identity = await real_mongo.service(1).authenticate(first.raw_token)
    assert identity.csrf_token == first.csrf_token
    real_mongo.service().verify_csrf(identity, first.csrf_token)
    stored = await real_mongo.db.admin_sessions.find_one(
        {"token_hash": identity.token_hash}
    )
    assert isinstance(stored["expires_at"], datetime)
    assert stored["expires_at"].tzinfo is None  # real Motor codec exercised
    assert first.raw_token not in repr(stored)
    assert first.csrf_token not in repr(stored)
    await real_mongo.service(1).logout(first.raw_token)
    with pytest.raises(AuthError):
        await real_mongo.service().authenticate(first.raw_token)
    await real_mongo.service().authenticate(second.raw_token)
    real_mongo.clock.now += timedelta(hours=12)
    with pytest.raises(AuthError):
        await real_mongo.service().authenticate(second.raw_token)


@pytest.mark.asyncio
async def test_real_mongo_rolling_window_and_success_preserve_pending_budget(
    real_mongo,
):
    repository = real_mongo.service().attempts
    key = "controlled-ip-hmac"
    reservations = [
        await repository.reserve(key, real_mongo.clock.now) for _ in range(5)
    ]
    await real_mongo.service(1).attempts.clear(
        key, reservations[0], real_mongo.clock.now
    )
    await repository.reserve(key, real_mongo.clock.now)
    with pytest.raises(AuthError) as error:
        await repository.reserve(key, real_mongo.clock.now)
    assert error.value.status_code == 429
    real_mongo.clock.now += timedelta(minutes=10)
    assert await repository.reserve(key, real_mongo.clock.now)


# Task 3: exercise the actual server composition, not a router-only test app.
@pytest.fixture
def server_loader(monkeypatch, password_hash):
    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for name in ("MONGODB_URI", "MONGO_MONGODB_URI", "MONGO_URL", "DB_NAME", "VERCEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", password_hash)
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "task3-test-secret-at-least-32-bytes")
    monkeypatch.setenv("CORS_ORIGINS", "https://fireart.test")
    modules = []

    def load(**environment):
        for name, value in environment.items():
            monkeypatch.setenv(name, value)
        spec = importlib.util.spec_from_file_location(
            "fireart_task3_" + uuid.uuid4().hex,
            Path(__file__).resolve().parents[1] / "server.py",
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        modules.append(module)
        return module

    yield load
    for module in modules:
        if module.client is not None:
            module.client.close()


def server_client(server):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=server.app), base_url="https://fireart.test"
    )


def test_server_lifespan_can_start_on_a_fresh_event_loop(server_loader):
    server = server_loader(
        MONGODB_URI="mongodb://127.0.0.1:27184/?serverSelectionTimeoutMS=10",
        DB_NAME="fireartro_fresh_loop_test",
    )

    async def start_and_stop():
        async with server.app.router.lifespan_context(server.app):
            assert server.app.state.indexes_ready is False

    asyncio.run(start_and_stop())


@pytest.mark.asyncio
async def test_server_missing_env_imports_and_fails_closed(server_loader, monkeypatch):
    for name in ("ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "ADMIN_SESSION_SECRET"):
        monkeypatch.delenv(name)
    server = server_loader(VERCEL="1")
    assert server.client is None  # Never implicitly connect to localhost.
    async with server.app.router.lifespan_context(server.app):
        async with server_client(server) as client:
            assert (await client.get("/api/")).status_code == 200
            health = await client.get("/api/health")
            assert health.status_code == 503
            assert health.json() == {
                "status": "not_ready",
                "configuration_errors": [
                    "MONGODB_URI",
                    "DB_NAME",
                    "ADMIN_USERNAME",
                    "ADMIN_PASSWORD_HASH",
                    "ADMIN_SESSION_SECRET",
                ],
                "database": "not_configured",
                "indexes": "not_ready",
            }
            for path, method in [
                ("/api/admin/auth/login", "POST"),
                ("/api/admin/auth/session", "GET"),
                ("/api/admin/auth/logout", "POST"),
                ("/api/blog/posts", "GET"),
                ("/api/quotes", "GET"),
                ("/api/webhooks/resend", "POST"),
            ]:
                response = await client.request(method, path)
                assert response.status_code == 503
                assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value",
    [
        ("MONGODB_URI", "invalid://secret-uri-value"),
        ("DB_NAME", "invalid/database"),
        ("ADMIN_PASSWORD_HASH", "secret-invalid-hash"),
        ("ADMIN_SESSION_SECRET", "short-secret"),
    ],
)
async def test_server_health_invalid_config_is_safe(server_loader, field, value):
    environment = {
        "MONGODB_URI": "mongodb://127.0.0.1:27183/?replicaSet=testset",
        "DB_NAME": "fireartro_cms_test_config_" + uuid.uuid4().hex,
        field: value,
    }
    server = server_loader(**environment)
    async with server_client(server) as client:
        response = await client.get("/api/health")
    assert response.status_code == 503
    assert field in response.json()["configuration_errors"]
    assert value not in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize("alias", ["MONGO_MONGODB_URI", "MONGO_URL"])
@pytest.mark.parametrize("primary", [False, True])
async def test_server_mongo_alias_preference(server_loader, alias, primary):
    environment = {
        alias: "mongodb://127.0.0.1:27183/?replicaSet=testset",
        "DB_NAME": "fireartro_cms_test_alias_" + uuid.uuid4().hex,
    }
    if primary:
        environment.update(MONGODB_URI=environment[alias])
        environment[alias] = "invalid://alias"
    server = server_loader(**environment)
    async with server_client(server) as client:
        response = await client.get("/api/health")
    assert "MONGODB_URI" not in response.json()["configuration_errors"]
    assert "MONGO_MONGODB_URI" not in response.json()["configuration_errors"]
    assert "MONGO_URL" not in response.json()["configuration_errors"]


@pytest_asyncio.fixture
async def wired_server(server_loader):
    uri = os.environ.get("FIREART_AUTH_TEST_MONGO_URI")
    if not uri:
        pytest.skip("Explicit isolated Mongo opt-in required")
    assert uri == "mongodb://127.0.0.1:27183/?replicaSet=testset"
    name = "fireartro_cms_test_wiring_" + uuid.uuid4().hex
    server = server_loader(MONGODB_URI=uri, MONGO_URL=uri, DB_NAME=name)
    cleanup = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000)
    try:
        assert (await cleanup.admin.command("hello"))["setName"] == "testset"
        async with server.app.router.lifespan_context(server.app):
            yield server
    finally:
        assert name.startswith("fireartro_cms_test_wiring_")
        assert len(name.removeprefix("fireartro_cms_test_wiring_")) == 32
        await cleanup.drop_database(name)
        cleanup.close()
        print(f"Removed disposable database {name}")


@pytest.mark.asyncio
async def test_server_wired_login_session_csrf_logout(wired_server):
    async with server_client(wired_server) as client:
        denied = await client.post(
            "/api/admin/auth/login", json={"username": "admin", "password": "wrong"}
        )
        assert denied.status_code == 401
        assert denied.json() == {"detail": "Datele de autentificare nu sunt valide."}
        assert denied.headers["cache-control"] == "no-store"
        response = await client.post(
            "/api/admin/auth/login",
            json={"username": "admin", "password": "correct horse"},
        )
        assert response.status_code == 200
        for attribute in ("HttpOnly", "Secure", "SameSite=strict", "Path=/api/admin"):
            assert attribute in response.headers["set-cookie"]
        assert response.json()["admin"] == {"username": "admin"}
        csrf = response.json()["csrf_token"]
        raw = client.cookies[ADMIN_COOKIE_NAME]
        restored = await client.get("/api/admin/auth/session")
        assert restored.status_code == 200
        assert restored.json()["csrf_token"] == csrf
        assert restored.headers["cache-control"] == "no-store"
        assert (await client.post("/api/admin/auth/logout")).status_code == 403
        logout = await client.post(
            "/api/admin/auth/logout", headers={"X-CSRF-Token": csrf}
        )
        assert logout.status_code == 200
        assert "Max-Age=0" in logout.headers["set-cookie"]
        client.cookies.set(ADMIN_COOKIE_NAME, raw)
        assert (await client.get("/api/admin/auth/session")).status_code == 401
    stored = await wired_server.db.admin_sessions.find_one({})
    assert stored["revoked_at"] is not None
    assert stored["token_hash"] != raw


@pytest.mark.asyncio
async def test_server_startup_creates_real_indexes_and_is_ready(wired_server):
    sessions = await wired_server.db.admin_sessions.index_information()
    attempts = await wired_server.db.admin_login_attempts.index_information()
    assert sessions["expires_at_1"]["expireAfterSeconds"] == 0
    assert sessions["token_hash_1"]["unique"] is True
    assert attempts["expires_at_1"]["expireAfterSeconds"] == 0
    blog = await wired_server.db.blog_posts.index_information()
    assert blog["slug_1"]["unique"] is True
    async with server_client(wired_server) as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "configuration_errors": [],
        "database": "ready",
        "indexes": "ready",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["error", "timeout"])
async def test_server_health_database_failure_is_bounded_and_nonleaking(
    wired_server, monkeypatch, failure
):
    async def command(*args, **kwargs):
        if failure == "timeout":
            await asyncio.sleep(60)
        raise AutoReconnect("mongodb://secret:password@private-host/database")

    monkeypatch.setattr(wired_server.db, "command", command)
    started = asyncio.get_running_loop().time()
    async with server_client(wired_server) as client:
        response = await asyncio.wait_for(client.get("/api/health"), timeout=3)
    assert asyncio.get_running_loop().time() - started < 3
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "configuration_errors": [],
        "database": "unavailable",
        "indexes": "ready",
    }


@pytest.mark.asyncio
async def test_server_cors_allows_csrf_and_patch(server_loader):
    server = server_loader(
        MONGO_URL="mongodb://127.0.0.1:27183",
        DB_NAME="fireartro_cms_test_cors_" + uuid.uuid4().hex,
    )
    async with server_client(server) as client:
        response = await client.options(
            "/api/admin/auth/logout",
            headers={
                "Origin": "https://fireart.test",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "X-CSRF-Token,Content-Type",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://fireart.test"
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path,limit",
    [
        ("/api/admin/auth/login", 4096),
        ("/api/admin/auth/session", 4096),
        ("/api/admin/auth/logout", 4096),
        ("/api/quotes", 32_768),
        ("/api/webhooks/resend", 64 * 1024),
        ("/api/admin/inbox/inbound-001/reply", 128 * 1024),
        ("/api/admin/blog/posts", 128 * 1024),
        ("/api/admin/blog/media", 6 * 1024 * 1024),
    ],
)
@pytest.mark.parametrize("declared", [None, "1", "actual"])
async def test_server_stream_limit_stops_at_overflow_before_route(
    server_loader, path, limit, declared
):
    server = server_loader(
        MONGO_URL="mongodb://127.0.0.1:27183",
        DB_NAME="fireartro_cms_test_body_" + uuid.uuid4().hex,
    )
    # The real app must reject before routing or reading any of the huge tail.
    consumed = 0

    async def chunks():
        nonlocal consumed
        consumed += limit
        yield b"x" * limit
        consumed += 1
        yield b"x"
        pytest.fail("Read past the first byte exceeding the route limit")

    headers = {"Content-Type": "application/json"}
    if declared is not None:
        headers["Content-Length"] = str(limit + 1) if declared == "actual" else declared
    async with server_client(server) as client:
        response = await client.post(path, headers=headers, content=chunks())
    assert response.status_code == 413
    assert consumed == (0 if declared == "actual" else limit + 1)
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path,limit",
    [
        ("/api/admin/auth/login", 4096),
        ("/api/admin/auth/session", 4096),
        ("/api/admin/auth/logout", 4096),
        ("/api/quotes", 32_768),
        ("/api/webhooks/resend", 64 * 1024),
        ("/api/admin/inbox/inbound-001/reply", 128 * 1024),
        ("/api/admin/blog/posts", 128 * 1024),
        ("/api/admin/blog/media", 6 * 1024 * 1024),
    ],
)
@pytest.mark.parametrize("declared", [None, "1", "actual"])
async def test_server_stream_limit_preserves_allowed_payload(
    server_loader, path, limit, declared
):
    server = server_loader(
        MONGO_URL="mongodb://127.0.0.1:27183",
        DB_NAME="fireartro_cms_test_body_" + uuid.uuid4().hex,
    )
    # Wrap the actual server middleware around a consuming endpoint to verify
    # byte-for-byte replay independently of route authorization, JSON parsing,
    # and the media-reference mutex. Those concerns have their own contracts;
    # this test characterizes the streamed-body limiter only.
    from fastapi import Request
    from fastapi.responses import Response

    server.app.router.routes.clear()

    # The real Blog write path adds a session-checked media guard.  Remove it
    # from this deliberately route-less harness so a valid 128 KiB replay can
    # reach the echo endpoint without weakening that production guard.
    server.app.user_middleware = [
        middleware
        for middleware in server.app.user_middleware
        if middleware.cls is not server.MediaWriteGuardMiddleware
    ]
    server.app.middleware_stack = server.app.build_middleware_stack()

    @server.app.post(path)
    async def echo(request: Request):
        return Response(await request.body())

    payload = b"a" * (limit - 1) + b"z"

    async def chunks():
        for offset in range(0, len(payload), 1024):
            yield payload[offset : offset + 1024]

    headers = {}
    if declared is not None:
        headers["Content-Length"] = str(limit) if declared == "actual" else declared
    async with server_client(server) as client:
        response = await client.post(path, headers=headers, content=chunks())
    assert response.status_code == 200
    assert response.content == payload


@pytest.mark.asyncio
async def test_server_failed_index_startup_keeps_health_and_auth_closed(
    server_loader, monkeypatch
):
    server = server_loader(
        MONGODB_URI="mongodb://127.0.0.1:27183/?replicaSet=testset",
        DB_NAME="fireartro_cms_test_index_failure_" + uuid.uuid4().hex,
    )

    async def fail_index(*args, **kwargs):
        raise AutoReconnect("private-connection-error")

    async def ping(*args, **kwargs):
        return {"ok": 1}

    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            blog_posts=SimpleNamespace(create_index=fail_index),
            command=ping,
        ),
    )
    async with server.app.router.lifespan_context(server.app):
        async with server_client(server) as client:
            health = await client.get("/api/health")
            assert health.status_code == 503
            assert health.json()["indexes"] == "not_ready"
            assert "private-connection-error" not in health.text
            response = await client.post(
                "/api/admin/auth/login",
                json={"username": "admin", "password": "correct horse"},
            )
            assert response.status_code == 503
            assert "set-cookie" not in response.headers
            assert response.headers["cache-control"] == "no-store"
            assert (await client.get("/api/")).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "length,status",
    [
        ("-1", 400),
        ("nope", 400),
        ("9" * 5000, 413),
        ("32769", 413),
    ],
)
async def test_server_rejects_invalid_or_oversized_declared_length_without_reading(
    server_loader, length, status
):
    server = server_loader()

    async def unread_body():
        pytest.fail("Rejected Content-Length must not consume the body")
        yield b"unreachable"

    async with server_client(server) as client:
        response = await client.post(
            "/api/admin/auth/login",
            headers={"Content-Length": length},
            content=unread_body(),
        )
    assert response.status_code == status
    assert response.headers["cache-control"] == "no-store"
