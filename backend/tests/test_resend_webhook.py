"""Signed Resend receiving webhook contracts at the real API boundary."""

import base64
import importlib.util
import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from pymongo.errors import AutoReconnect
from svix.webhooks import Webhook

from email_inbox import InboundIdentityConflict
from resend_email import ReceivedEmail, ResendError


WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"task-five-webhook-secret").decode()


def event_body(event_type="email.received", email_id="re_inbound_001"):
    return json.dumps(
        {"type": event_type, "data": {"email_id": email_id}},
        separators=(",", ":"),
    ).encode()


def signed_headers(body, *, webhook_id="msg_001"):
    timestamp = datetime.now(timezone.utc).replace(microsecond=0)
    signature = Webhook(WEBHOOK_SECRET).sign(webhook_id, timestamp, body.decode())
    return {
        "content-type": "application/json",
        "svix-id": webhook_id,
        "svix-timestamp": str(int(timestamp.timestamp())),
        "svix-signature": signature,
    }


class FakeInboundRepository:
    def __init__(self, events):
        self.events = events
        self.completed = set()
        self.reserved = set()
        self.messages = []
        self.reserve_failure = None
        self.upsert_failure = None

    async def create_indexes(self):
        return None

    async def reserve_webhook_event(self, *, webhook_id, resend_email_id):
        self.events.append("reserve")
        if self.reserve_failure is not None:
            raise self.reserve_failure
        key = (webhook_id, resend_email_id)
        known = self.completed | self.reserved
        if key in self.completed:
            return False
        if any(
            (known_webhook == webhook_id and known_email != resend_email_id)
            or (known_webhook != webhook_id and known_email == resend_email_id)
            for known_webhook, known_email in known
        ):
            raise InboundIdentityConflict()
        self.reserved.add(key)
        return True

    async def upsert_received(self, **payload):
        self.events.append("persist")
        if self.upsert_failure is not None:
            raise self.upsert_failure
        message = SimpleNamespace(
            id="inbound-001", relay_state="pending", **deepcopy(payload)
        )
        self.messages.append(message)
        self.completed.add((payload["webhook_id"], payload["resend_email_id"]))
        return message

    async def get_internal_by_identity(self, *, webhook_id, resend_email_id):
        for message in self.messages:
            if (
                message.webhook_id == webhook_id
                and message.resend_email_id == resend_email_id
            ):
                return message
        return None


class FakeResendClient:
    def __init__(self, events):
        self.events = events
        self.failure = None
        self.email = ReceivedEmail(
            id="re_inbound_001",
            sender="Client@example.com",
            recipients=["contact@fireart.ro"],
            subject="Întrebare despre eveniment",
            text="Conținut privat",
            html="<p>Conținut privat</p>",
            message_id="<message@example.com>",
            references=["<root@example.com>"],
            attachments=[],
        )

    async def get_received_email(self, email_id):
        self.events.append("fetch")
        if self.failure is not None:
            raise self.failure
        return self.email


class FakeRelayService:
    def __init__(self, events):
        self.events = events
        self.failure = None
        self.messages = []

    async def relay(self, message):
        self.events.append("relay")
        self.messages.append(message)
        if self.failure is not None:
            message.relay_state = "failed"
            raise self.failure
        message.relay_state = "sent"

    async def retry(self, message):
        self.events.append("retry")
        return await self.relay(message)


@pytest.fixture
def webhook_server(monkeypatch):
    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    for name in ("MONGODB_URI", "MONGO_URL", "DB_NAME", "VERCEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "task5-test-secret-at-least-32-bytes")
    spec = importlib.util.spec_from_file_location(
        "fireart_task5_" + uuid.uuid4().hex,
        Path(__file__).resolve().parents[1] / "server.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    events = []
    module.db = SimpleNamespace()
    module.resend_webhook_verifier = Webhook(WEBHOOK_SECRET)
    module.inbound_repository = FakeInboundRepository(events)
    module.resend_client = FakeResendClient(events)
    module.inbound_relay_service = FakeRelayService(events)
    yield module, events
    if module.client is not None:
        module.client.close()


def api_client(server):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=server.app),
        base_url="https://fireart.test",
    )


@pytest.mark.asyncio
async def test_webhook_requires_all_svix_headers_before_route_work(webhook_server):
    server, events = webhook_server
    body = event_body()
    headers = signed_headers(body)
    async with api_client(server) as client:
        missing = await client.post(
            "/api/webhooks/resend",
            content=body,
            headers={"content-type": "application/json"},
        )
        invalid = await client.post(
            "/api/webhooks/resend",
            content=body,
            headers={**headers, "svix-signature": "v1,invalid"},
        )

    assert missing.status_code == 400
    assert invalid.status_code == 400
    assert events == []


@pytest.mark.asyncio
async def test_signed_email_received_persists_before_relay_and_normalizes_category(
    webhook_server,
):
    server, events = webhook_server
    body = event_body()
    async with api_client(server) as client:
        response = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )

    assert response.status_code == 204
    assert events == ["reserve", "fetch", "persist", "relay"]
    assert server.inbound_repository.messages[0].category == "contact"
    assert server.inbound_relay_service.messages[0].recipients == ["contact@fireart.ro"]


@pytest.mark.asyncio
async def test_valid_unrelated_event_and_completed_duplicate_are_noops(webhook_server):
    server, events = webhook_server
    unrelated = event_body("email.sent", "re_must_not_fetch")
    async with api_client(server) as client:
        ignored = await client.post(
            "/api/webhooks/resend",
            content=unrelated,
            headers=signed_headers(unrelated),
        )
        duplicate_body = event_body()
        server.inbound_repository.completed.add(("msg_001", "re_inbound_001"))
        duplicate = await client.post(
            "/api/webhooks/resend",
            content=duplicate_body,
            headers=signed_headers(duplicate_body),
        )

    assert ignored.status_code == 204
    assert duplicate.status_code == 204
    assert events == ["reserve"]


@pytest.mark.asyncio
async def test_mismatched_duplicate_identity_is_bad_request(webhook_server):
    server, events = webhook_server
    server.inbound_repository.completed.add(("msg_existing", "re_inbound_001"))
    body = event_body()
    async with api_client(server) as client:
        response = await client.post(
            "/api/webhooks/resend",
            content=body,
            headers=signed_headers(body, webhook_id="msg_different"),
        )

    assert response.status_code == 400
    assert events == ["reserve"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure", [ResendError("provider_unavailable"), ResendError("delivery_failed")]
)
async def test_provider_fetch_failure_is_retryable_and_does_not_persist(
    webhook_server, failure
):
    server, events = webhook_server
    server.resend_client.failure = failure
    body = event_body()
    async with api_client(server) as client:
        response = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )

    assert response.status_code == 503
    assert events == ["reserve", "fetch"]
    assert server.inbound_repository.messages == []
    assert "provider_unavailable" not in response.text


@pytest.mark.asyncio
async def test_database_and_relay_failures_are_retryable_without_leaking_details(
    webhook_server,
):
    server, events = webhook_server
    server.inbound_repository.reserve_failure = AutoReconnect(
        "mongodb://secret:password@private-host"
    )
    body = event_body()
    async with api_client(server) as client:
        database_failure = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )

        server.inbound_repository.reserve_failure = None
        server.inbound_relay_service.failure = ResendError("provider_unavailable")
        relay_failure = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )

    assert database_failure.status_code == 503
    assert relay_failure.status_code == 503
    assert events == ["reserve", "reserve", "fetch", "persist", "relay"]
    assert len(server.inbound_repository.messages) == 1
    assert "password" not in database_failure.text + relay_failure.text


@pytest.mark.asyncio
async def test_completed_webhook_retries_only_a_failed_relay(webhook_server):
    server, events = webhook_server
    server.inbound_relay_service.failure = ResendError("provider_unavailable")
    body = event_body()
    async with api_client(server) as client:
        failed = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )
        server.inbound_relay_service.failure = None
        retried = await client.post(
            "/api/webhooks/resend", content=body, headers=signed_headers(body)
        )

    assert failed.status_code == 503
    assert retried.status_code == 204
    assert events == [
        "reserve",
        "fetch",
        "persist",
        "relay",
        "reserve",
        "retry",
        "relay",
    ]
