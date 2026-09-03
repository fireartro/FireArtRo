"""Safe, authenticated integration-health contracts."""
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from integrations import IntegrationsService, create_integrations_router
from test_cms_routes import RouteAuthService, authorize


class Database:
    def __init__(self, available=True):
        self.available = available
        self.calls = 0

    async def command(self, name):
        self.calls += 1
        assert name == "ping"
        if not self.available:
            raise TimeoutError()
        return {"ok": 1}


class Reviews:
    def __init__(self):
        self.calls = 0

    async def integration_health(self, *, refresh=False):
        self.calls += 1
        return {
            "google": {"configured": True, "healthy": True, "checked_at": datetime(2026, 9, 3, tzinfo=timezone.utc)},
            "facebook": {"configured": True, "healthy": False, "checked_at": datetime(2026, 9, 3, tzinfo=timezone.utc)},
        }


def environment(**changes):
    return {
        "BLOB_READ_WRITE_TOKEN": "vercel_blob_rw_test_secret",
        "VERCEL_BLOB_MEDIA_ORIGIN": "https://localtest.public.blob.vercel-storage.com",
        "GOOGLE_PLACES_API_KEY": "google-secret-value",
        "GOOGLE_PLACE_ID": "place-id",
        "META_PAGE_ID": "page-id",
        "META_PAGE_ACCESS_TOKEN": "meta-secret-value",
        **changes,
    }


def test_status_is_authenticated_redacts_secrets_and_throttles_refreshes():
    database, reviews = Database(), Reviews()
    service = IntegrationsService(database, reviews, environment(), minimum_refresh_seconds=60)
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_integrations_router(service))

    with TestClient(app) as client:
        assert client.get("/api/admin/integrations").status_code == 401
        headers = authorize(client)
        response = client.get("/api/admin/integrations", headers=headers)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert "google-secret-value" not in response.text
        assert "meta-secret-value" not in response.text
        body = response.json()
        assert body["database"] == {"configured": True, "healthy": True, "checked_at": body["database"]["checked_at"], "message": ""}
        assert body["blob"]["configured"] is True
        assert body["google"]["configured"] is True
        assert body["google"]["healthy"] is True
        assert body["facebook"]["healthy"] is False

        again = client.get("/api/admin/integrations?refresh=true", headers=headers)
        assert again.status_code == 200
        assert database.calls == 1
        assert reviews.calls == 1


def test_unconfigured_or_unavailable_services_return_only_safe_states():
    service = IntegrationsService(
        Database(available=False),
        Reviews(),
        environment(
            BLOB_READ_WRITE_TOKEN="",
            GOOGLE_PLACES_API_KEY="",
            GOOGLE_PLACE_ID="",
            META_PAGE_ID="",
            META_PAGE_ACCESS_TOKEN="",
        ),
    )

    state = asyncio.run(service.status())
    assert state.database.configured is True
    assert state.database.healthy is False
    assert state.blob.configured is False
    assert state.blob.healthy is None
    assert state.google.configured is False
    assert state.google.healthy is None
    assert state.facebook.configured is False
    assert "secret" not in state.model_dump_json()
