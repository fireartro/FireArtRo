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
    def __init__(self, events=None):
        self.documents = []
        self.events = events if events is not None else []

    async def insert_one(self, document):
        self.documents.append(deepcopy(document))
        self.events.append("inserted")
        return SimpleNamespace(inserted_id=document["id"])


class QuoteRateLimiter:
    def __init__(self):
        self.client_ips = []

    async def enforce(self, client_ip):
        self.client_ips.append(client_ip)


class FakeNotificationDeliveryRepository:
    def __init__(self):
        self.delivery = None

    async def create_or_get(self, **kwargs):
        if self.delivery is None:
            self.delivery = SimpleNamespace(
                id="delivery-quote-001",
                kind=kwargs["kind"],
                state="pending",
                idempotency_key=kwargs["idempotency_key"],
                related_quote_id=kwargs["related_quote_id"],
                recipient=kwargs["recipient"],
                error_code=None,
                sent_at=None,
                updated_at=None,
            )
        return self.delivery

    async def get_current_quote_notification(self, quote_id):
        return self.delivery

    async def mark_failed(self, delivery_id, *, error_code):
        self.delivery.state = "failed"
        self.delivery.error_code = error_code
        return self.delivery

    async def mark_sent(self, delivery_id, *, resend_email_id):
        self.delivery.state = "sent"
        self.delivery.error_code = None
        self.delivery.sent_at = "sent-at"
        return self.delivery


class FakeResendClient:
    def __init__(self, events, *, failure=None):
        self.events = events
        self.failure = failure
        self.config = SimpleNamespace(
            from_email="FireArtRo <contact@fireart.ro>",
            notification_to="fireartro@gmail.com",
        )

    async def send(self, **kwargs):
        self.events.append(("send", kwargs))
        assert self.events[0] == "inserted"
        if self.failure is not None:
            raise self.failure
        return "re_quote_notification_001"


@pytest.fixture
def public_server(monkeypatch):
    """Load server.py without a network database, keeping the public route real."""
    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for name in ("MONGODB_URI", "MONGO_URL", "DB_NAME", "VERCEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(
        "ADMIN_SESSION_SECRET", "quote-route-test-secret-at-least-32-bytes"
    )

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
async def test_public_submission_acknowledges_without_leaking_customer_details(
    public_server,
):
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
async def test_public_submission_inserts_before_sending_and_uses_safe_notification_contract(
    public_server,
):
    from quote_admin import QuoteNotificationService

    server, collection, _ = public_server
    events = collection.events
    delivery = FakeNotificationDeliveryRepository()
    sender = FakeResendClient(events)
    server.quote_notification_service = QuoteNotificationService(sender, delivery)

    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload())

    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert events[0] == "inserted"
    assert events[1][0] == "send"
    sent = events[1][1]
    assert sender.config.from_email == "FireArtRo <contact@fireart.ro>"
    assert sender.config.notification_to == "fireartro@gmail.com"
    assert sent["to"] == "fireartro@gmail.com"
    assert sent["reply_to"] == "andrei@example.com"
    assert (
        sent["idempotency_key"] == f"quote-notification/{collection.documents[0]['id']}"
    )
    assert "Popescu" not in response.text
    assert "andrei@example.com" not in response.text
    assert "delivery" not in response.text
    assert "customer" not in response.text


@pytest.mark.asyncio
async def test_provider_failure_keeps_saved_quote_and_returns_public_acknowledgement(
    public_server,
):
    from quote_admin import QuoteNotificationService
    from resend_email import ResendError

    server, collection, _ = public_server
    delivery = FakeNotificationDeliveryRepository()
    sender = FakeResendClient(
        collection.events, failure=ResendError("provider_unavailable")
    )
    server.quote_notification_service = QuoteNotificationService(sender, delivery)

    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload())

    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert len(collection.documents) == 1
    assert delivery.delivery.state == "failed"
    assert delivery.delivery.error_code == "provider_unavailable"
    assert "provider_unavailable" not in response.text


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
async def test_honeypot_submission_receives_acknowledgement_without_persistence(
    public_server,
):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post(
            "/api/quotes", json=valid_payload(company_website="spam.example")
        )
    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert collection.documents == []
