"""Public quote contracts executed against the real in-process API app."""

import importlib.util
import uuid
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest


def valid_payload(**overrides):
    payload = {
        "first_name": "Popescu",
        "last_name": "Andrei",
        "phone": "0712345678",
        "email": "andrei@example.com",
        "locality": "București",
        "event_location": "Sala Exemplu",
        "event_type": "Nuntă",
        "event_date": "2026-08-15",
        "services": ["Show drone", "Drone + artificii"],
        "package_id": "hybrid-signature",
        "package_title": "Hybrid Signature",
        "message": "Solicitare de test.",
        "consent": True,
        "company_website": "",
    }
    payload.update(overrides)
    return payload


class QuoteCollection:
    def __init__(self):
        self.documents = []

    async def insert_one(self, document):
        self.documents.append(deepcopy(document))
        return SimpleNamespace(inserted_id=document["id"])


class QuoteRateLimiter:
    def __init__(self):
        self.client_ips = []

    async def enforce(self, client_ip):
        self.client_ips.append(client_ip)


@pytest.fixture
def public_server(monkeypatch):
    """Load server.py without a network database, keeping the public route real."""
    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for name in ("MONGODB_URI", "MONGO_URL", "DB_NAME", "VERCEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "quote-route-test-secret-at-least-32-bytes")

    spec = importlib.util.spec_from_file_location(
        "fireart_quotes_" + uuid.uuid4().hex,
        Path(__file__).resolve().parents[1] / "server.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    collection, limiter = QuoteCollection(), QuoteRateLimiter()
    module.db = SimpleNamespace(quotes=collection)
    module.quote_rate_limiter = limiter
    yield module, collection, limiter
    if module.client is not None:
        module.client.close()


def api_client(server):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=server.app, client=("198.51.100.7", 1234)),
        base_url="https://fireart.test",
    )


@pytest.mark.asyncio
async def test_public_api_root_is_available(public_server):
    server, _, _ = public_server
    async with api_client(server) as client:
        response = await client.get("/api/")
    assert response.status_code == 200
    assert response.json() == {"message": "FireArtRo API"}


@pytest.mark.asyncio
async def test_public_submission_acknowledges_without_leaking_customer_details(public_server):
    server, collection, limiter = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload())

    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert "Popescu" not in response.text
    assert limiter.client_ips == ["198.51.100.7"]
    assert len(collection.documents) == 1
    stored = collection.documents[0]
    assert stored["first_name"] == "Popescu"
    assert stored["services"] == ["Show drone", "Drone + artificii"]
    assert stored["status"] == "new"
    assert stored["internal_note"] == ""
    assert stored["version"] == 0
    assert "company_website" not in stored


@pytest.mark.asyncio
async def test_public_submission_requires_consent(public_server):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(consent=False))
    assert response.status_code == 422
    assert collection.documents == []


@pytest.mark.asyncio
async def test_public_submission_requires_at_least_one_service(public_server):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(services=[]))
    assert response.status_code == 422
    assert collection.documents == []


@pytest.mark.asyncio
async def test_honeypot_submission_receives_acknowledgement_without_persistence(public_server):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post(
            "/api/quotes", json=valid_payload(company_website="spam.example")
        )
    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert collection.documents == []
