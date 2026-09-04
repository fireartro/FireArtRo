"""Protected Admin inbox, reply, and relay-retry route contracts."""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth import ADMIN_COOKIE_NAME, AuthError, AdminIdentity
from resend_email import ResendError
from test_cms_routes import CSRF_TOKEN, SESSION_TOKEN
from test_email_inbox import AsyncCollection, inbound_document


class RouteAuthService:
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


class ResendSender:
    def __init__(self):
        self.calls = []
        self.failure = None
        self.persisted_at_send = []
        self.reply_collection = None
        self.delivery_collection = None

    async def send(self, **kwargs):
        self.calls.append(kwargs)
        if self.reply_collection is not None:
            self.persisted_at_send.append(
                (
                    len(self.reply_collection.documents),
                    len(self.delivery_collection.documents),
                )
            )
        if self.failure is not None:
            raise self.failure
        return "re_reply_001"


@pytest.fixture
def inbox_domain():
    from email_inbox import (
        InboundRelayService,
        MongoEmailDeliveryRepository,
        MongoInboundMessageRepository,
        MongoInboundReplyRepository,
        InboundReplyService,
        create_inbound_admin_router,
    )

    documents = [
        inbound_document(
            "inbound-001",
            datetime(2026, 9, 4, 10, tzinfo=timezone.utc),
            subject="Re: Re: Cerere de ofertă",
            message_id="<message-001@example.com>",
            references=[
                "<reference-%02d@example.com>" % index for index in range(1, 21)
            ],
        )
    ]
    inbound_collection = AsyncCollection(documents)
    delivery_collection = AsyncCollection()
    reply_collection = AsyncCollection()
    inbound_repository = MongoInboundMessageRepository(inbound_collection)
    delivery_repository = MongoEmailDeliveryRepository(delivery_collection)
    reply_repository = MongoInboundReplyRepository(reply_collection)
    sender = ResendSender()
    sender.reply_collection = reply_collection
    sender.delivery_collection = delivery_collection
    asyncio.run(inbound_repository.create_indexes())
    asyncio.run(delivery_repository.create_indexes())
    asyncio.run(reply_repository.create_indexes())
    relay_service = InboundRelayService(sender, delivery_repository, inbound_repository)
    reply_service = InboundReplyService(
        sender, reply_repository, delivery_repository, inbound_repository
    )

    application = FastAPI()
    application.state.auth_service = RouteAuthService()
    application.include_router(
        create_inbound_admin_router(
            inbound_repository,
            reply_repository,
            relay_service,
            reply_service,
        )
    )
    with TestClient(application) as client:
        yield client, inbound_collection, delivery_collection, reply_collection, sender


def authorize(client):
    client.cookies.set(ADMIN_COOKIE_NAME, SESSION_TOKEN)
    return {"X-CSRF-Token": CSRF_TOKEN}


def test_every_inbox_route_requires_session_and_mutations_require_csrf(
    inbox_domain,
):
    client, _, _, _, _ = inbox_domain
    for method, path in [
        ("get", "/api/admin/inbox"),
        ("get", "/api/admin/inbox/inbound-001"),
        ("post", "/api/admin/inbox/inbound-001/relay/retry"),
        ("post", "/api/admin/inbox/inbound-001/reply"),
    ]:
        response = getattr(client, method)(path)
        assert response.status_code == 401
        assert response.headers["cache-control"] == "no-store"

    client.cookies.set(ADMIN_COOKIE_NAME, SESSION_TOKEN)
    for path in (
        "/api/admin/inbox/inbound-001/relay/retry",
        "/api/admin/inbox/inbound-001/reply",
    ):
        response = client.post(path, json={"text": "Salut"})
        assert response.status_code == 403
        assert response.headers["cache-control"] == "no-store"


def test_list_is_safe_summary_and_detail_is_no_store(inbox_domain):
    client, _, _, _, _ = inbox_domain
    headers = authorize(client)

    listing = client.get("/api/admin/inbox", headers=headers)
    detail = client.get("/api/admin/inbox/inbound-001", headers=headers)

    assert listing.status_code == 200
    assert detail.status_code == 200
    assert listing.headers["cache-control"] == "no-store"
    assert detail.headers["cache-control"] == "no-store"
    assert "Text inbound-001" not in listing.text
    assert "HTML inbound-001" not in listing.text
    assert detail.json()["text"] == "Text inbound-001"
    assert "html" not in detail.json()


def test_reply_uses_stored_sender_thread_headers_and_stable_delivery(inbox_domain):
    client, _, delivery_collection, reply_collection, sender = inbox_domain
    headers = authorize(client)

    rejected = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=headers,
        json={"text": "Salut", "to": "attacker@example.com"},
    )
    assert rejected.status_code == 422
    assert sender.calls == []

    response = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=headers,
        json={
            "reply_id": "11111111-1111-4111-8111-111111111111",
            "text": "  Răspuns trimis  ",
        },
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert sender.calls[0]["to"] == "sender-inbound-001@example.com"
    assert sender.calls[0]["subject"] == "Re: Cerere de ofertă"
    assert sender.calls[0]["in_reply_to"] == "<message-001@example.com>"
    assert sender.calls[0]["references"] == [
        "<reference-%02d@example.com>" % index for index in range(2, 21)
    ] + ["<message-001@example.com>"]
    assert (
        sender.calls[0]["idempotency_key"]
        == "admin-reply/inbound-001/11111111-1111-4111-8111-111111111111"
    )
    assert sender.persisted_at_send == [(1, 1)]
    assert reply_collection.documents[0]["text"] == "Răspuns trimis"
    assert response.json()["replies"][0]["text"] == "Răspuns trimis"

    duplicate = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=headers,
        json={
            "reply_id": "11111111-1111-4111-8111-111111111111",
            "text": "Răspuns trimis",
        },
    )
    conflict = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=headers,
        json={
            "reply_id": "11111111-1111-4111-8111-111111111111",
            "text": "Alt conținut",
        },
    )
    assert duplicate.status_code == 200
    assert conflict.status_code == 409
    assert len(sender.calls) == 1
    assert len(reply_collection.documents) == 1
    assert len(delivery_collection.documents) == 1


def test_failed_reply_is_persisted_and_same_reply_id_can_retry(inbox_domain):
    client, _, delivery_collection, reply_collection, sender = inbox_domain
    headers = authorize(client)
    command = {
        "reply_id": "22222222-2222-4222-8222-222222222222",
        "text": "Revenim cu detalii.",
    }
    sender.failure = ResendError("provider_unavailable")

    failed = client.post(
        "/api/admin/inbox/inbound-001/reply", headers=headers, json=command
    )
    assert failed.status_code == 503
    assert reply_collection.documents[0]["state"] == "failed"
    assert delivery_collection.documents[0]["state"] == "failed"

    sender.failure = None
    retried = client.post(
        "/api/admin/inbox/inbound-001/reply", headers=headers, json=command
    )
    assert retried.status_code == 200
    assert reply_collection.documents[0]["state"] == "sent"
    assert delivery_collection.documents[0]["state"] == "sent"
    assert len(sender.calls) == 2
    assert len({call["idempotency_key"] for call in sender.calls}) == 1


@pytest.mark.parametrize("text", ["", " ", "x" * 12_001])
def test_reply_text_is_trimmed_and_bounded(inbox_domain, text):
    client, _, _, _, sender = inbox_domain
    response = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=authorize(client),
        json={"text": text},
    )

    assert response.status_code == 422
    assert sender.calls == []


def test_reply_accepts_twelve_thousand_unicode_characters(inbox_domain):
    client, _, _, _, sender = inbox_domain
    response = client.post(
        "/api/admin/inbox/inbound-001/reply",
        headers=authorize(client),
        json={"text": "ă" * 12_000},
    )

    assert response.status_code == 200
    assert len(sender.calls[0]["text"]) == 12_000


def test_relay_retry_is_only_allowed_for_failed_message(inbox_domain):
    client, inbound_collection, _, _, sender = inbox_domain
    headers = authorize(client)

    pending = client.post("/api/admin/inbox/inbound-001/relay/retry", headers=headers)
    assert pending.status_code == 409
    assert sender.calls == []

    inbound_collection.documents[0]["relay_state"] = "failed"
    inbound_collection.documents[0]["relay_error_code"] = "provider_unavailable"
    retried = client.post("/api/admin/inbox/inbound-001/relay/retry", headers=headers)

    assert retried.status_code == 200
    assert sender.calls[0]["idempotency_key"] == "inbound-relay/provider-inbound-001"
    assert retried.json()["relay_state"] == "sent"
