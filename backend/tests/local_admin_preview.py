"""Loopback-only UI QA over a detached public snapshot; never a production server.

Run with PYTHONPATH=backend and Python backend/tests/local_admin_preview.py.
All edits/publications are in memory, and disappear when this process exits.
No production Admin credentials, private drafts, or database access are used.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlopen

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

from auth import ADMIN_COOKIE_NAME, AdminIdentity, AuthError
from cms_routes import create_cms_router
from cms_service import CmsService
from test_cms_service import InMemoryCmsRepository

BUILD = Path(__file__).resolve().parents[2] / "frontend" / "build"
SESSION = "local-ui-qa-only"
CSRF = "local-ui-qa-csrf-only"
EXPIRY = datetime.now(timezone.utc) + timedelta(hours=2)


class LocalAuth:
    async def authenticate(self, token):
        if token != SESSION:
            raise AuthError()
        return AdminIdentity(username="VERIFICARE LOCALĂ", expires_at=EXPIRY,
                             token_hash="local", csrf_hash="local", csrf_token=CSRF)

    def verify_csrf(self, identity, token):
        if token != CSRF:
            raise AuthError("CSRF local invalid", 403)


def create_app():
    with urlopen("https://fireart.ro/api/content", timeout=15) as response:
        content = json.load(response)["content"]
    service = CmsService(InMemoryCmsRepository())
    asyncio.run(service.bootstrap(content, "local-qa"))
    app = FastAPI()
    app.state.auth_service = LocalAuth()
    app.include_router(create_cms_router(service))

    @app.get("/api/admin/auth/session")
    def session():
        response = JSONResponse({"admin": {"username": "VERIFICARE LOCALĂ"},
                                 "csrf_token": CSRF, "expires_at": EXPIRY.isoformat()},
                                headers={"Cache-Control": "no-store"})
        response.set_cookie(ADMIN_COOKIE_NAME, SESSION, httponly=True, samesite="strict")
        return response

    @app.get("/api/{path:path}")
    def unsupported(path):
        raise HTTPException(404, "Acest mediu verifică numai editorul CMS.")

    @app.get("/{path:path}")
    def asset(path):
        candidate = (BUILD / path).resolve()
        if not candidate.is_relative_to(BUILD):
            raise HTTPException(404)
        return FileResponse(candidate if candidate.is_file() else BUILD / "index.html",
                            headers={"Cache-Control": "no-store"})

    return app


if __name__ == "__main__":
    uvicorn.run(create_app(), host="127.0.0.1", port=4198, log_level="warning")
