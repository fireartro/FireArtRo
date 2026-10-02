"""Authenticated multipart boundary and rollover regressions (no real I/O)."""

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartParser

from auth import ADMIN_COOKIE_NAME
from blog import create_blog_router
from media import MediaWriteGuardMiddleware
from test_cms_routes import RouteAuthService, SESSION_TOKEN, CSRF_TOKEN
from test_quotes import public_server


@pytest.mark.asyncio
async def test_multipart_text_limit_keeps_early_auth_csrf_mime_and_body_guard(public_server, monkeypatch):
    server, _, _ = public_server
    writes = []

    class Store:
        async def save(self, filename, content_type, data):
            writes.append(data)
            return "111111111111111111111111"

    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_blog_router(SimpleNamespace(media_store=Store())))
    app.add_middleware(MediaWriteGuardMiddleware, service=None)
    app.add_middleware(server.RequestSecurityMiddleware)
    parsed = []
    original = MultiPartParser.parse

    async def record_parse(self):
        parsed.append(True)
        return await original(self)

    monkeypatch.setattr(MultiPartParser, "parse", record_parse)
    cookie = {"Cookie": f"{ADMIN_COOKIE_NAME}={SESSION_TOKEN}"}
    authorized = {**cookie, "X-CSRF-Token": CSRF_TOKEN, "Origin": "http://testserver"}
    image = b"\x89PNG\r\n\x1a\nsynthetic"
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        assert (await client.post("/api/admin/blog/media", files={"file": ("test.png", image, "image/png")})).status_code == 401
        assert (await client.post("/api/admin/blog/media", headers=cookie, files={"file": ("test.png", image, "image/png")})).status_code == 403
        assert (await client.post("/api/admin/blog/media", headers=authorized, data={"file": "bad"})).status_code == 415
        assert (await client.post("/api/admin/blog/media", headers=authorized, content=b"x" * (6 * 1024 * 1024 + 1))).status_code == 413
        assert parsed == []
        oversized = await client.post("/api/admin/blog/media", headers=authorized,
            data={"unused": "x" * (2 * 1024 * 1024)}, files={"file": ("test.png", image, "image/png")})
        assert oversized.status_code == 400
        assert writes == []
        valid = await client.post("/api/admin/blog/media", headers=authorized, files={"file": ("test.png", image, "image/png")})
        assert valid.status_code == 201
        assert writes == [image]


@pytest.mark.asyncio
async def test_rollover_runs_off_event_loop():
    class RolloverFile:
        _rolled = False
        _max_size = 1024 * 1024
        called_from_event_loop = None

        def tell(self): return self._max_size
        def write(self, data):
            try:
                asyncio.get_running_loop()
                self.called_from_event_loop = True
            except RuntimeError:
                self.called_from_event_loop = False
            self._rolled = True

    file = RolloverFile()
    await UploadFile(file, size=1024 * 1024).write(b"x")
    assert file.called_from_event_loop is False
