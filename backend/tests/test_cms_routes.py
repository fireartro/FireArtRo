"""HTTP contracts for FireArtRo's public and Admin CMS endpoints."""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.testclient import TestClient

from auth import ADMIN_COOKIE_NAME, AdminIdentity, AuthError
from cms_models import SiteContent
from cms_routes import create_cms_router
from cms_service import CmsService
from test_cms_models import default_content as default_content_fixture
from test_cms_service import Clock, InMemoryCmsRepository


SESSION_TOKEN = "valid-session"
CSRF_TOKEN = "valid-csrf-token"


class RouteAuthService:
    """Small app-state double that exercises the real session dependency."""

    async def authenticate(self, raw_token):
        if raw_token != SESSION_TOKEN:
            raise AuthError()
        return AdminIdentity(
            username="administrator",
            expires_at=datetime(2026, 9, 4, tzinfo=timezone.utc),
            token_hash="session-hash",
            csrf_hash="csrf-hash",
            csrf_token=CSRF_TOKEN,
        )

    def verify_csrf(self, identity, csrf_token):
        if csrf_token != CSRF_TOKEN:
            raise AuthError("Cererea nu este permisă.", 403)


def content_payload():
    return SiteContent.model_validate(default_content_fixture.__wrapped__()).model_dump(mode="json")


@pytest.fixture
def app():
    clock = Clock()
    revision_ids = iter([f"revision-{number}" for number in range(1, 20)])
    service = CmsService(
        InMemoryCmsRepository(),
        clock=clock,
        revision_id_factory=lambda: next(revision_ids),
    )
    asyncio.run(service.bootstrap(content_payload(), "initialization"))

    application = FastAPI()
    application.state.auth_service = RouteAuthService()
    application.include_router(create_cms_router(service))
    return application


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def authorize(client):
    client.cookies.set(ADMIN_COOKIE_NAME, SESSION_TOKEN)
    return {"X-CSRF-Token": CSRF_TOKEN}


def test_bootstrap_is_protected_and_does_not_replace_existing_publication(client):
    assert client.post("/api/admin/content/bootstrap", json=content_payload()).status_code == 401
    headers = authorize(client)
    assert client.post("/api/admin/content/bootstrap", json=content_payload()).status_code == 403
    before = client.get("/api/content").json()
    edited = content_payload()
    edited["siteDetails"]["name"] = "Nu suprascrie"
    response = client.post("/api/admin/content/bootstrap", json=edited, headers=headers)
    assert response.status_code == 200
    assert response.json()["created"] is False
    assert client.get("/api/content").json() == before


def test_public_content_revalidates_by_etag_without_admin_metadata(client):
    first = client.get("/api/content")

    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-cache, must-revalidate"
    assert first.headers["etag"] == '"revision-1"'
    assert set(first.json()) == {"revision_id", "published_at", "content"}
    assert "updated_by" not in first.text
    assert "published_by" not in first.text

    unchanged = client.get("/api/content", headers={"If-None-Match": first.headers["etag"]})
    assert unchanged.status_code == 304
    assert unchanged.content == b""
    assert unchanged.headers["cache-control"] == "no-cache, must-revalidate"


def test_admin_draft_mutations_require_session_csrf_and_current_version(client):
    payload = content_payload()

    assert client.get("/api/admin/content/draft").status_code == 401

    authorize(client)
    without_csrf = client.put("/api/admin/content/draft", json={"version": 0, "content": payload})
    assert without_csrf.status_code == 403

    headers = authorize(client)
    saved = client.put("/api/admin/content/draft", json={"version": 0, "content": payload}, headers=headers)
    assert saved.status_code == 200
    assert saved.headers["cache-control"] == "no-store"
    assert saved.json()["version"] == 1

    stale = client.put("/api/admin/content/draft", json={"version": 0, "content": payload}, headers=headers)
    assert stale.status_code == 409
    assert "versiune" in stale.json()["detail"].lower()


def test_admin_publish_revisions_and_restore_keep_public_snapshot_intact(client):
    headers = authorize(client)
    changed = content_payload()
    changed["siteDetails"]["name"] = "FireArtRo editat"
    saved = client.put("/api/admin/content/draft", json={"version": 0, "content": changed}, headers=headers)
    assert saved.status_code == 200

    published = client.post(
        "/api/admin/content/publish",
        json={"version": 1, "summary": "Schimbare denumire"},
        headers=headers,
    )
    assert published.status_code == 200
    assert published.headers["cache-control"] == "no-store"
    revision_id = published.json()["publication"]["revision_id"]

    revisions = client.get("/api/admin/content/revisions")
    assert revisions.status_code == 200
    assert revisions.headers["cache-control"] == "no-store"
    assert revisions.json()[0]["id"] == revision_id
    assert "content" not in revisions.text

    historical = client.get(f"/api/admin/content/revisions/{revision_id}")
    assert historical.status_code == 200
    assert historical.json()["content"]["siteDetails"]["name"] == "FireArtRo editat"

    public_before_restore = client.get("/api/content").json()
    restored = client.post(
        "/api/admin/content/revisions/revision-1/restore",
        json={"version": 2},
        headers=headers,
    )
    assert restored.status_code == 200
    assert restored.json()["content"]["siteDetails"]["name"] == "FireArtRo"
    assert client.get("/api/content").json() == public_before_restore
    assert client.get("/api/admin/content/revisions/absent").status_code == 404


def test_invalid_admin_draft_is_rejected_without_changing_public_content(client):
    headers = authorize(client)
    invalid = content_payload()
    invalid["packages"][0]["title"] = ""
    public_before = client.get("/api/content").json()

    response = client.put(
        "/api/admin/content/draft",
        json={"version": 0, "content": invalid},
        headers=headers,
    )

    assert response.status_code == 422
    assert client.get("/api/content").json() == public_before


def test_server_mounts_cms_and_preserves_its_public_cache_and_body_limits(monkeypatch):
    import server

    monkeypatch.setattr(server, "db", object())
    assert "/api/content" in {route.path for route in server.app.routes}

    inner = FastAPI()

    @inner.get("/api/content")
    async def public_content():
        return Response(
            content="{}",
            media_type="application/json",
            headers={"Cache-Control": "no-cache, must-revalidate"},
        )

    @inner.put("/api/admin/content/draft")
    async def draft_content(request: Request):
        return {"bytes": len(await request.body())}

    with TestClient(server.RequestSecurityMiddleware(inner)) as secured_client:
        public = secured_client.get("/api/content")
        assert public.headers["cache-control"] == "no-cache, must-revalidate"

        draft = secured_client.put(
            "/api/admin/content/draft",
            content=b'{"padding":"' + (b"x" * 40_000) + b'"}',
            headers={"Content-Type": "application/json"},
        )
        assert draft.status_code == 200
        assert draft.json()["bytes"] > 32_768
