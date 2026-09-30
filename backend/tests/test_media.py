"""Local media lifecycle tests; Mongo and Blob boundaries never use the network."""
import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from auth import ADMIN_COOKIE_NAME
from blog import BlogService, create_blog_router
from media import (
    MediaError, MediaInUse, MediaService, MediaWriteGuardMiddleware,
    create_media_router, find_references, validate_blob,
)
from test_auth import domain, login, password_hash, server_loader
from test_blog import FakeBlogRepository, FakeMediaStore
from test_cms_routes import RouteAuthService, authorize


ORIGIN = "https://localtest.public.blob.vercel-storage.com"
MEDIA_ID = "media-11111111-1111-4111-8111-111111111111"
PATH = f"cms/{MEDIA_ID}/asset.webp"


def blob(**changes):
    return {"id": MEDIA_ID, "pathname": PATH, "url": f"{ORIGIN}/{PATH}",
            "content_type": "image/webp", "size": 1200, "filename": "Cadru.webp",
            "alt_text": "", "state": "ready", "width": 120, "height": 80,
            "created_at": datetime(2026, 9, 3, tzinfo=timezone.utc), **changes}


class Repository:
    def __init__(self):
        self.items = {MEDIA_ID: blob()}
        self.documents = []
        self.locked = False

    async def get(self, media_id):
        return deepcopy(self.items.get(media_id))

    async def list(self, limit, offset):
        return [deepcopy(item) for item in self.items.values()
                if item["state"] in {"ready", "pending", "deleting"}][offset:offset + limit]

    async def references(self, item):
        return find_references(item, self.documents)

    async def references_many(self, items):
        return {item['id']: find_references(item, self.documents) for item in items}

    async def update_alt(self, media_id, value):
        self.items[media_id]["alt_text"] = value

    async def set_state(self, media_id, state):
        self.items[media_id]["state"] = state

    async def resolve(self, value):
        return next((deepcopy(x) for x in self.items.values()
                     if value in {x["id"], x["url"], x["pathname"]}), None)

    @asynccontextmanager
    async def write_guard(self):
        if self.locked:
            raise MediaError(409, "Operație în curs.")
        self.locked = True
        try:
            yield
        finally:
            self.locked = False


class BlobStore:
    def __init__(self):
        self.deleted = []
        self.failure = False

    def ensure_configured(self):
        pass

    async def delete(self, url):
        if self.failure:
            raise RuntimeError("provider-secret-must-not-leak")
        self.deleted.append(url)


@pytest.fixture
def service():
    return MediaService(Repository(), BlobStore(), origin=ORIGIN)


@pytest.mark.parametrize("changes", [
    {"content_type": "image/svg+xml"}, {"size": 0}, {"size": True},
    {"size": 8 * 1024 * 1024 + 1},
    {"content_type": "video/mp4", "size": 500 * 1024 * 1024 + 1},
    {"pathname": "cms/../secret.webp"}, {"url": "https://evil.example/file"},
    {"url": f"{ORIGIN}/{PATH}?redirect=evil"},
])
def test_invalid_blob_metadata_is_rejected(changes):
    with pytest.raises(MediaError):
        validate_blob(blob(**changes), ORIGIN)


@pytest.mark.parametrize("mime,extension,size", [
    ("image/webp", "webp", 8 * 1024 * 1024),
    ("video/mp4", "mp4", 500 * 1024 * 1024),
])
def test_exact_size_boundaries_are_accepted(mime, extension, size):
    path = f"cms/{MEDIA_ID}/asset.{extension}"
    validate_blob(blob(content_type=mime, pathname=path, url=f"{ORIGIN}/{path}", size=size), ORIGIN)


@pytest.mark.asyncio
@pytest.mark.parametrize("collection,value", [
    ("site_content_drafts", MEDIA_ID),
    ("site_content_publications", f"{ORIGIN}/{PATH}"),
    ("site_content_revisions", f"{ORIGIN}/{PATH}?download=1"),
    ("blog_posts", MEDIA_ID),
])
async def test_every_persisted_reference_blocks_deletion(service, collection, value):
    service.repository.documents.append((collection, {"id": "historical", "content": {"cover": [value]}}))
    with pytest.raises(MediaInUse):
        await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert service.blob_client.deleted == []
    item = await service.get(MEDIA_ID)
    assert item["references"][0]["collection"] == collection
    assert item["usage_count"] == 1


@pytest.mark.asyncio
async def test_unreferenced_delete_keeps_tombstone_to_block_late_writes(service):
    await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert service.blob_client.deleted == [f"{ORIGIN}/{PATH}"]
    assert service.repository.items[MEDIA_ID]["state"] == "deleted"
    with pytest.raises(MediaError) as caught:
        async with service.reference_write_guard({"cover_media_id": MEDIA_ID}):
            pytest.fail("Deleted media may not be attached")
    assert caught.value.status_code == 409


@pytest.mark.asyncio
async def test_pending_media_is_visible_for_recovery_but_cannot_be_published(service):
    """A lost callback must not orphan an upload or expose it before verification."""
    service.repository.items[MEDIA_ID] = blob(state="pending", url=None, size=None, declared_size=1200)

    listed = await service.list()
    assert listed == [
        {
            **{key: service.repository.items[MEDIA_ID].get(key) for key in (
                "id", "pathname", "url", "content_type", "size", "filename", "alt_text",
                "width", "height", "dimensions_source", "created_at", "created_by", "state",
            )},
            "declared_size": 1200,
            "references": [],
            "usage_count": 0,
        }
    ]
    with pytest.raises(MediaError) as caught:
        await service.get(MEDIA_ID)
    assert caught.value.status_code == 404
    with pytest.raises(MediaError) as caught:
        async with service.reference_write_guard({"cover_media_id": MEDIA_ID}):
            pytest.fail("Pending media may not be attached")
    assert caught.value.status_code == 409

    # A user may also clear an abandoned pending record. Its canonical object is
    # deleted first so a late browser upload cannot leave an untracked Blob.
    await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert service.blob_client.deleted == [f"{ORIGIN}/{PATH}"]
    assert service.repository.items[MEDIA_ID]["state"] == "deleted"


@pytest.mark.asyncio
async def test_pending_delete_can_be_retried_after_a_storage_failure(service):
    service.repository.items[MEDIA_ID] = blob(state="pending", url=None, size=None, declared_size=1200)
    service.blob_client.failure = True

    with pytest.raises(MediaError) as caught:
        await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert caught.value.status_code == 503
    assert service.repository.items[MEDIA_ID]["state"] == "deleting"
    assert (await service.list())[0]["url"] is None

    service.blob_client.failure = False
    await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert service.repository.items[MEDIA_ID]["state"] == "deleted"


@pytest.mark.asyncio
async def test_failed_provider_delete_keeps_item_unavailable_until_retry(service):
    service.blob_client.failure = True
    with pytest.raises(MediaError) as caught:
        await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert caught.value.status_code == 503
    assert "secret" not in caught.value.detail
    assert service.repository.items[MEDIA_ID]["state"] == "deleting"
    service.blob_client.failure = False
    await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert service.repository.items[MEDIA_ID]["state"] == "deleted"


@pytest.mark.asyncio
async def test_write_and_delete_cannot_race(service):
    async with service.reference_write_guard({"url": f"{ORIGIN}/{PATH}"}):
        with pytest.raises(MediaError) as caught:
            await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
        assert caught.value.status_code == 409
        service.repository.documents.append(("blog_posts", {"id": "new", "cover_media_id": MEDIA_ID}))
    with pytest.raises(MediaInUse):
        await service.delete(MEDIA_ID, confirm_id=MEDIA_ID)
    assert not service.blob_client.deleted


def test_routes_auth_csrf_alt_confirmation_and_no_store(service):
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_media_router(service))
    with TestClient(app) as client:
        assert client.get("/api/admin/media").status_code == 401
        headers = authorize(client)
        path = f"/api/admin/media/{MEDIA_ID}"
        assert client.patch(path, json={"alt_text": "x"}).status_code == 403
        assert client.patch(path, json={"alt_text": "x"}, headers={**headers, "Origin": "https://evil.example"}).status_code == 403
        saved = client.patch(path, json={"alt_text": "  Lumină   în cer  "}, headers=headers)
        assert saved.status_code == 200
        assert saved.json()["alt_text"] == "Lumină în cer"
        assert saved.headers["cache-control"] == "no-store"
        assert client.delete(path, headers=headers).status_code == 422
        deleted = client.request("DELETE", path, json={"confirm_id": MEDIA_ID}, headers=headers)
        assert deleted.status_code == 204
        assert client.get(path).status_code == 404


def test_middleware_guards_cms_and_blog_writes_and_releases_lock(service):
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.add_middleware(MediaWriteGuardMiddleware, service=service)

    @app.put("/api/admin/content/draft")
    @app.post("/api/admin/blog/posts")
    async def save():
        assert service.repository.locked
        return {"saved": True}

    with TestClient(app) as client:
        headers = authorize(client)
        for method, path in [("PUT", "/api/admin/content/draft"), ("POST", "/api/admin/blog/posts")]:
            assert client.request(method, path, headers=headers, json={"cover": MEDIA_ID}).status_code == 200
            assert not service.repository.locked
            service.repository.items[MEDIA_ID]["state"] = "deleted"
            assert client.request(method, path, headers=headers, json={"cover": MEDIA_ID}).status_code == 409
            service.repository.items[MEDIA_ID]["state"] = "ready"


@pytest_asyncio.fixture
async def blog_upload(domain, service, monkeypatch):
    """Real session/CSRF and UploadFile handling, with in-memory storage only."""
    store = FakeMediaStore()
    app = FastAPI()
    app.state.auth_service = domain.auth
    app.add_middleware(MediaWriteGuardMiddleware, service=service)
    app.include_router(create_blog_router(BlogService(FakeBlogRepository(), store)))
    issued = await login(domain.auth)
    probe = SimpleNamespace(body_reads=0, form_parses=0)
    original_form = Request.form

    def count_form(request, *args, **kwargs):
        probe.form_parses += 1
        return original_form(request, *args, **kwargs)

    monkeypatch.setattr(Request, "form", count_form)

    async def observed_app(scope, receive, send):
        async def count_receive():
            probe.body_reads += 1
            return await receive()

        await app(scope, count_receive, send)

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=observed_app),
        base_url="https://fireart.test",
    ) as client:
        yield SimpleNamespace(
            app=observed_app, client=client, auth=domain.auth, clock=domain.clock,
            issued=issued, store=store, probe=probe,
            headers={"Origin": "https://fireart.test", "X-CSRF-Token": issued.csrf_token},
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/admin/blog/media", "/api/admin/blog/media/"])
@pytest.mark.parametrize("content_type,body", [
    ("multipart/form-data", b"--hostile-private-data-without-a-boundary"),
    ("application/x-www-form-urlencoded", b"file=hostile-private-data&" * 2000),
], ids=["missing-boundary", "urlencoded-fields"])
@pytest.mark.parametrize("denial,status", [
    ("missing-session", 401), ("invalid-session", 401),
    ("expired-session", 401), ("revoked-session", 401),
    ("missing-csrf", 403), ("invalid-csrf", 403),
    ("cross-origin", 403), ("cross-site", 403),
])
async def test_blog_upload_denied_before_body_receive_or_form_parse(
    blog_upload, service, path, content_type, body, denial, status,
):
    upload = blog_upload
    headers = {**upload.headers, "Content-Type": content_type}
    if denial != "missing-session":
        token = "invalid" if denial == "invalid-session" else upload.issued.raw_token
        upload.client.cookies.set(ADMIN_COOKIE_NAME, token)
    if denial == "expired-session":
        upload.clock.now += timedelta(hours=12)
    elif denial == "revoked-session":
        await upload.auth.logout(upload.issued.raw_token)
    elif denial == "missing-csrf":
        headers.pop("X-CSRF-Token")
    elif denial == "invalid-csrf":
        headers["X-CSRF-Token"] = "wrong"
    elif denial == "cross-origin":
        headers["Origin"] = "https://evil.example"
    elif denial == "cross-site":
        headers["Sec-Fetch-Site"] = "cross-site"

    response = await upload.client.post(path, content=body, headers=headers)

    assert response.status_code == status
    assert upload.probe.body_reads == 0
    assert upload.probe.form_parses == 0
    assert response.headers["cache-control"] == "no-store"
    assert set(response.json()) == {"detail"}
    assert "hostile-private-data" not in response.text
    assert upload.store.items == {}
    assert not service.repository.locked


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/admin/blog/media", "/api/admin/blog/media/"])
@pytest.mark.parametrize("content_type", [
    None, "application/x-www-form-urlencoded", "application/json",
    "text/plain", "multipart/form-data-evil",
])
async def test_authenticated_blog_upload_requires_multipart_before_receiving(
    blog_upload, path, content_type,
):
    upload = blog_upload
    upload.client.cookies.set(ADMIN_COOKIE_NAME, upload.issued.raw_token)
    headers = dict(upload.headers)
    if content_type is not None:
        headers["Content-Type"] = content_type

    response = await upload.client.post(path, content=b"file=hostile-private-data", headers=headers)

    assert response.status_code == 415
    assert response.headers["cache-control"] == "no-store"
    assert set(response.json()) == {"detail"}
    assert "hostile-private-data" not in response.text
    assert upload.probe.body_reads == 0
    assert upload.probe.form_parses == 0
    assert upload.store.items == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/admin/blog/media", "/api/admin/blog/media/"])
async def test_authenticated_blog_upload_preserves_bytes_and_bypasses_reference_lock(
    blog_upload, service, path,
):
    upload = blog_upload
    upload.client.cookies.set(ADMIN_COOKIE_NAME, upload.issued.raw_token)
    # Larger than the Blog JSON limit, while a reference writer holds its lock.
    image = b"RIFF\x04\x00\x00\x00WEBP" + b"\x00" * (128 * 1024)
    service.repository.locked = True

    response = await upload.client.post(
        path, files={"file": ("coperta.webp", image, "image/webp")},
        headers=upload.headers, follow_redirects=True,
    )

    assert response.status_code == 201
    assert [item.status_code for item in response.history] == ([307] if path.endswith("/") else [])
    assert upload.store.items[response.json()["id"]] == {
        "filename": "coperta.webp", "content_type": "image/webp", "data": image,
    }
    assert response.json()["url"] == f"/api/blog/media/{response.json()['id']}"
    assert upload.probe.body_reads > 0
    assert upload.probe.form_parses == 1
    assert service.repository.locked


@pytest.mark.asyncio
@pytest.mark.parametrize("file_type,data,status", [
    ("text/plain", b"not-an-image", 415),
    ("image/webp", b"not-an-image", 415),
    ("image/webp", b"RIFF\x04\x00\x00\x00WEBP" + b"\x00" * (6 * 1024 * 1024), 413),
], ids=["non-image", "false-signature", "oversized-image"])
async def test_authenticated_blog_upload_preserves_image_checks(blog_upload, file_type, data, status):
    upload = blog_upload
    upload.client.cookies.set(ADMIN_COOKIE_NAME, upload.issued.raw_token)
    response = await upload.client.post(
        "/api/admin/blog/media", files={"file": ("coperta.webp", data, file_type)},
        headers=upload.headers,
    )
    assert response.status_code == status
    assert upload.store.items == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("path,size,status", [
    ("/api/admin/blog/media", 128 * 1024, 201),
    ("/api/admin/blog/media", 6 * 1024 * 1024, 413),
    ("/api/admin/blog/media/", 1024, 201),
    ("/api/admin/blog/media/", 32 * 1024, 413),
])
async def test_blog_upload_keeps_outer_total_body_limit_and_no_store(
    blog_upload, server_loader, monkeypatch, path, size, status,
):
    upload = blog_upload
    server = server_loader()
    # Only satisfy the middleware's readiness gate; no Mongo client or data.
    monkeypatch.setattr(server, "db", object())
    secured_app = server.RequestSecurityMiddleware(upload.app)
    image = b"RIFF\x04\x00\x00\x00WEBP" + b"\x00" * (size - 12)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=secured_app), base_url="https://fireart.test",
    ) as client:
        client.cookies.set(ADMIN_COOKIE_NAME, upload.issued.raw_token)
        response = await client.post(
            path, files={"file": ("coperta.webp", image, "image/webp")},
            headers=upload.headers, follow_redirects=True,
        )

    assert response.status_code == status
    assert response.headers["cache-control"] == "no-store"
    if status == 413:
        # The file fits the existing path limit; multipart framing exceeds it.
        assert upload.probe.body_reads == upload.probe.form_parses == 0
        assert upload.store.items == {}
    else:
        assert upload.store.items[response.json()["id"]]["data"] == image
