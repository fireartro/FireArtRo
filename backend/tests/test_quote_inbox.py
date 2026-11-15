"""Form conversations use the inbox without turning quotes into inbound emails."""

import asyncio
from datetime import datetime, timedelta, timezone
import os
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from email_inbox import (
    InboundReplyService,
    InboundReplyError,
    MongoInboundMessageRepository,
    MongoInboundReplyRepository,
    QuoteReplyTarget,
    create_inbound_admin_router,
)
from test_email_inbox import AsyncCollection, inbound_document
from test_email_inbox_routes import ResendSender, RouteAuthService, authorize
from test_quote_admin import quote
from test_quote_recovery import DeliveryCollection

from quote_admin import MongoQuoteDeliveryRepository

REPLY = {"reply_id": "11111111-1111-4111-8111-111111111111", "text": "Oferta de test <script>"}


def test_saved_quote_reply_is_private_bound_to_stored_recipient_and_repeat_safe():
    # Look up an existing quote, with no inbound copy or Resend notification.
    from quote_inbox import MongoQuoteInbox

    quotes = AsyncCollection([quote(), quote("hidden", status="spam")])
    inbound_collection = AsyncCollection()
    inbound = MongoInboundMessageRepository(inbound_collection)
    replies = MongoInboundReplyRepository(AsyncCollection())
    deliveries = MongoQuoteDeliveryRepository(DeliveryCollection())
    sender = ResendSender()
    service = InboundReplyService(sender, replies, deliveries, inbound)
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_inbound_admin_router(
        inbound, replies, None, service, quote_inbox=MongoQuoteInbox(quotes, inbound_collection)
    ))
    path = "/api/admin/inbox/quote-q1"
    with TestClient(app) as client:
        assert client.get(path).status_code == 401
        assert client.post(f"{path}/reply", json=REPLY).status_code == 401
        headers = authorize(client)
        detail = client.get(path)
        assert detail.status_code == 200
        assert detail.headers["cache-control"] == "no-store"
        assert detail.json()["category"] == "quote"
        assert detail.json()["from"] == "ana@example.com"
        assert detail.json()["text"] == "Mesaj client"
        assert detail.json()["quote"]["event_location"] == "Sala"
        assert "Notă privată" not in detail.text and "must-not-leak" not in detail.text
        assert client.post(f"{path}/reply", json=REPLY).status_code == 403
        assert client.post(f"{path}/reply", headers=headers, json={
            **REPLY, "to": "another@example.com",
        }).status_code == 422
        assert client.post("/api/admin/inbox/quote-hidden/reply", headers=headers, json=REPLY).status_code == 404
        assert client.post(f"{path}/relay/retry", headers=headers).status_code == 409
        assert not sender.calls
        for _ in range(2):
            result = client.post(f"{path}/reply", headers=headers, json=REPLY)
            assert result.status_code == 200
            assert [(item["text"], item["state"]) for item in result.json()["replies"]] == [
                (REPLY["text"], "sent"),
            ]
            assert "re_reply_001" not in result.text
        assert client.post(f"{path}/reply", headers=headers, json={
            **REPLY, "text": "Alt conținut pentru trimiterea existentă",
        }).status_code == 409
    assert len(sender.calls) == 1
    sent = sender.calls[0]
    assert sent["to"] == "ana@example.com"
    assert "FireArtRo" in sent["subject"] and not sent["subject"].startswith("Re:")
    assert sent["in_reply_to"] is None and sent["references"] == []
    assert "&lt;script&gt;" in sent["html"]
    assert inbound_collection.documents == []


@pytest.mark.asyncio
async def test_quote_reply_reserves_provider_call_and_cannot_repeat_after_uncertain_send():
    now = datetime(2026, 11, 15, 10, tzinfo=timezone.utc)
    deliveries = MongoQuoteDeliveryRepository(DeliveryCollection(), clock=lambda: now)
    replies = MongoInboundReplyRepository(AsyncCollection(), clock=lambda: now)
    accepted = asyncio.Event()
    provider_calls = 0

    class Provider:
        async def send(self, **kwargs):
            nonlocal provider_calls
            provider_calls += 1
            if provider_calls == 1:
                accepted.set()
                await asyncio.Future()  # response lost after the provider accepted it
            return "duplicate-provider-id"

    service = InboundReplyService(Provider(), replies, deliveries, object())
    target = QuoteReplyTarget("quote-q1", "q1", "ana@example.com")
    first = asyncio.create_task(service.reply(target, **REPLY))
    try:
        await asyncio.wait_for(accepted.wait(), timeout=1)
        with pytest.raises(InboundReplyError):
            await service.reply(target, **REPLY)
        assert provider_calls == 1
    finally:
        first.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first
    now += timedelta(days=2)
    with pytest.raises(InboundReplyError):
        await service.reply(target, **REPLY)
    assert provider_calls == 1


@pytest.mark.asyncio
async def test_real_mongo_combines_and_paginates_both_sources_without_leaking_payloads():
    uri = os.environ.get("FIREART_AUTH_TEST_MONGO_URI")
    if uri is None:
        pytest.skip("Requires the explicitly isolated local MongoDB replica set")
    assert uri == "mongodb://127.0.0.1:27183/?replicaSet=testset"
    from motor.motor_asyncio import AsyncIOMotorClient
    from quote_inbox import MongoQuoteInbox

    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=2000)
    name = f"fireart_inbox_test_{uuid.uuid4().hex}"
    try:
        hello = await client.admin.command("hello")
        assert hello["setName"] == "testset"
        database = client[name]
        inbox = MongoQuoteInbox(database.quotes, database.inbound_messages)
        newer = datetime(2026, 11, 6, 10, tzinfo=timezone.utc)
        older = datetime(2026, 11, 5, 10, tzinfo=timezone.utc)
        await database.quotes.insert_many([
            quote("old", created_at=older),
            quote("new", created_at=newer),
            quote("spam", created_at=newer, status="spam"),
        ])
        await database.inbound_messages.insert_many([
            inbound_document("mail", older, subject="Mesaj normal"),
            inbound_document("reserved", newer, ingest_state="reserved"),
        ])
        first = await inbox.list(page=1, page_size=2)
        second = await inbox.list(page=2, page_size=2)
        assert first.total == second.total == 3
        assert [item.id for item in first.items] == ["quote-new", "quote-old"]
        assert [item.id for item in second.items] == ["mail"]
        quotes = await inbox.list(category="quote", q="Ana Popescu")
        assert [item.id for item in quotes.items] == ["quote-new", "quote-old"]
        assert (await inbox.list(q=".*")).items == []
        assert "Notă privată" not in first.model_dump_json()
        assert "Mesaj client" not in first.model_dump_json()
        assert await database.quotes.count_documents({}) == 3
    finally:
        await client.drop_database(name)
        client.close()
