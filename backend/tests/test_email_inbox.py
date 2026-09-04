"""Contract tests for durable outbound delivery and inbound inbox storage."""

import asyncio
import re
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, branch) for branch in expected):
                return False
            continue
        if key == "$and":
            if not all(matches(document, branch) for branch in expected):
                return False
            continue

        actual = document.get(key)
        if not isinstance(expected, dict):
            if actual != expected:
                return False
            continue

        for operator, value in expected.items():
            if operator == "$exists" and (key in document) != value:
                return False
            if operator == "$in" and actual not in value:
                return False
            if operator == "$ne" and actual == value:
                return False
            if operator == "$lt" and not actual < value:
                return False
            if operator == "$lte" and not actual <= value:
                return False
            if operator == "$gt" and not actual > value:
                return False
            if operator == "$gte" and not actual >= value:
                return False
            if operator == "$regex":
                flags = re.I if expected.get("$options") == "i" else 0
                if re.search(value, str(actual or ""), flags) is None:
                    return False
            if operator not in {
                "$exists",
                "$in",
                "$ne",
                "$lt",
                "$lte",
                "$gt",
                "$gte",
                "$regex",
                "$options",
            }:
                raise AssertionError(f"Unsupported query operator: {operator}")
    return True


def project(document, projection):
    if document is None:
        return None
    if not projection:
        return deepcopy(document)
    included = {key for key, enabled in projection.items() if enabled == 1}
    if included:
        return deepcopy({key: document[key] for key in included if key in document})
    return deepcopy(
        {key: value for key, value in document.items() if projection.get(key, 1) != 0}
    )


class Cursor:
    def __init__(
        self, documents, *, require_bounded_queries=False, query_timeouts=None
    ):
        self.documents = documents
        self.require_bounded_queries = require_bounded_queries
        self.query_timeouts = query_timeouts if query_timeouts is not None else []
        self.timeout = None

    def sort(self, fields, direction=None):
        if isinstance(fields, str):
            fields = [(fields, direction)]
        for field, order in reversed(fields):
            self.documents.sort(key=lambda item: item.get(field), reverse=order == -1)
        return self

    def skip(self, count):
        self.documents = self.documents[count:]
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    def max_time_ms(self, milliseconds):
        assert 0 < milliseconds <= 2_000
        self.timeout = milliseconds
        self.query_timeouts.append(milliseconds)
        return self

    async def to_list(self, length):
        await asyncio.sleep(0)
        if self.require_bounded_queries:
            assert self.timeout is not None
        return deepcopy(self.documents[:length])


class AsyncCollection:
    """Small Motor-shaped collection with real uniqueness and projections."""

    def __init__(self, documents=(), *, require_bounded_queries=False):
        self.documents = deepcopy(list(documents))
        self.indexes = []
        self.unique_indexes = []
        self.projections = []
        self.query_timeouts = []
        self.require_bounded_queries = require_bounded_queries

    def record_query_timeout(self, milliseconds):
        if self.require_bounded_queries:
            assert milliseconds is not None
        if milliseconds is not None:
            assert 0 < milliseconds <= 2_000
            self.query_timeouts.append(milliseconds)

    @staticmethod
    def index_fields(keys):
        if isinstance(keys, str):
            return (keys,)
        return tuple(key for key, _ in keys)

    async def create_index(self, keys, **options):
        fields = self.index_fields(keys)
        self.indexes.append((keys, deepcopy(options)))
        if options.get("unique"):
            self.unique_indexes.append(fields)
        return options.get("name", "_".join(fields))

    def enforce_unique(self, candidate, *, ignored=None):
        for fields in self.unique_indexes:
            for existing in self.documents:
                if existing is ignored:
                    continue
                if all(existing.get(field) == candidate.get(field) for field in fields):
                    raise DuplicateKeyError(f"duplicate test index: {','.join(fields)}")

    async def insert_one(self, document):
        await asyncio.sleep(0)
        candidate = deepcopy(document)
        self.enforce_unique(candidate)
        self.documents.append(candidate)
        return SimpleNamespace(inserted_id=candidate.get("_id", candidate.get("id")))

    async def find_one(self, query, projection=None, **kwargs):
        await asyncio.sleep(0)
        assert not set(kwargs) - {"max_time_ms", "sort"}
        self.record_query_timeout(kwargs.get("max_time_ms"))
        self.projections.append(deepcopy(projection))
        candidates = [item for item in self.documents if matches(item, query)]
        for field, order in reversed(kwargs.get("sort") or []):
            candidates.sort(key=lambda item: item.get(field), reverse=order == -1)
        found = candidates[0] if candidates else None
        return project(found, projection)

    def find(self, query, projection=None):
        self.projections.append(deepcopy(projection))
        return Cursor(
            [
                project(item, projection)
                for item in self.documents
                if matches(item, query)
            ],
            require_bounded_queries=self.require_bounded_queries,
            query_timeouts=self.query_timeouts,
        )

    async def count_documents(self, query, **kwargs):
        assert not set(kwargs) - {"maxTimeMS"}
        self.record_query_timeout(kwargs.get("maxTimeMS"))
        return sum(matches(item, query) for item in self.documents)

    async def find_one_and_update(
        self,
        query,
        update,
        *,
        return_document=ReturnDocument.BEFORE,
        projection=None,
        upsert=False,
        max_time_ms=None,
        **kwargs,
    ):
        await asyncio.sleep(0)
        assert not set(kwargs) - {"maxTimeMS"}
        self.record_query_timeout(max_time_ms or kwargs.get("maxTimeMS"))
        assert not set(update) - {"$set", "$setOnInsert", "$inc"}
        existing = next((item for item in self.documents if matches(item, query)), None)
        before = deepcopy(existing)
        if existing is None and upsert:
            equality = {
                key: deepcopy(value)
                for key, value in query.items()
                if not key.startswith("$") and not isinstance(value, dict)
            }
            existing = {
                **equality,
                **deepcopy(update.get("$setOnInsert", {})),
                **deepcopy(update.get("$set", {})),
            }
            for key, amount in update.get("$inc", {}).items():
                existing[key] = existing.get(key, 0) + amount
            self.enforce_unique(existing)
            self.documents.append(existing)
            before = None
        elif existing is not None:
            candidate = deepcopy(existing)
            candidate.update(deepcopy(update.get("$set", {})))
            for key, amount in update.get("$inc", {}).items():
                candidate[key] = candidate.get(key, 0) + amount
            self.enforce_unique(candidate, ignored=existing)
            existing.clear()
            existing.update(candidate)
        result = existing if return_document == ReturnDocument.AFTER else before
        return project(result, projection)

    async def update_one(self, query, update, *, upsert=False):
        document = await self.find_one_and_update(
            query,
            update,
            return_document=ReturnDocument.AFTER,
            upsert=upsert,
        )
        return SimpleNamespace(
            matched_count=int(document is not None),
            modified_count=int(document is not None),
            upserted_id=None,
        )

    async def replace_one(self, query, replacement, *, upsert=False):
        await asyncio.sleep(0)
        existing = next((item for item in self.documents if matches(item, query)), None)
        if existing is None:
            if not upsert:
                return SimpleNamespace(
                    matched_count=0, modified_count=0, upserted_id=None
                )
            candidate = deepcopy(replacement)
            self.enforce_unique(candidate)
            self.documents.append(candidate)
            return SimpleNamespace(
                matched_count=0, modified_count=0, upserted_id=candidate.get("id")
            )
        candidate = deepcopy(replacement)
        self.enforce_unique(candidate, ignored=existing)
        existing.clear()
        existing.update(candidate)
        return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)


class MutableClock:
    def __init__(self, value):
        self.value = value

    def __call__(self):
        return self.value


class RacingInsertCollection(AsyncCollection):
    """Materialize a competing winner, then raise the insert race."""

    def __init__(self, winner_id):
        super().__init__(require_bounded_queries=True)
        self.winner_id = winner_id
        self.raced = False

    async def insert_one(self, document):
        if not self.raced:
            self.raced = True
            winner = deepcopy(document)
            winner["id"] = self.winner_id
            self.documents.append(winner)
            raise DuplicateKeyError("simulated concurrent insert")
        return await super().insert_one(document)


class RacingReserveCollection(AsyncCollection):
    """Materialize a mismatched winner, then raise the reservation insert race."""

    async def insert_one(self, document):
        winner = deepcopy(document)
        winner["resend_email_id"] = "provider-reservation-race-other"
        self.documents.append(winner)
        raise DuplicateKeyError("simulated mismatched reservation race")


def as_document(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
    return deepcopy(value)


def assert_unique_index(collection, field):
    assert (field,) in collection.unique_indexes


def assert_index(collection, keys, **options):
    assert any(
        saved_keys == keys
        and all(saved_options.get(key) == value for key, value in options.items())
        for saved_keys, saved_options in collection.indexes
    )


def inbound_document(identifier, received_at, category="contact", **changes):
    document = {
        "id": identifier,
        "resend_email_id": f"provider-{identifier}",
        "webhook_id": f"webhook-{identifier}",
        "message_id": f"<thread-{identifier}@example.com>",
        "references": ["<thread-root@example.com>"],
        "from": f"sender-{identifier}@example.com",
        "to": ["contact@inbound.example.com"],
        "subject": f"Subject {identifier}",
        "text": f"Text {identifier}",
        "html": f"<p>HTML {identifier}</p>",
        "attachments": [
            {
                "id": f"attachment-{identifier}",
                "filename": f"file-{identifier}.txt",
                "content_type": "text/plain",
                "size": 12,
            }
        ],
        "category": category,
        "received_at": received_at,
        "relay_state": "pending",
        "latest_reply_at": None,
        "raw_provider_payload": "must-not-leak",
        "private_secret": "must-not-leak",
        "future_sensitive_field": "must-not-leak",
    }
    document.update(changes)
    return document


@pytest.mark.asyncio
async def test_delivery_repository_creates_one_pending_record_per_idempotency_key():
    from email_inbox import MongoEmailDeliveryRepository

    instant = datetime(2026, 9, 4, 9, tzinfo=timezone.utc)
    identifiers = iter(["delivery-001", "delivery-must-not-be-used"])
    collection = AsyncCollection()
    repository = MongoEmailDeliveryRepository(
        collection,
        clock=lambda: instant,
        id_factory=lambda: next(identifiers),
    )

    await repository.create_indexes()
    first = await repository.create_or_get(
        kind="quote_notification",
        idempotency_key="quote-notification/quote-test-001",
        recipient="owner@example.com",
        related_quote_id="quote-test-001",
    )
    repeated = await repository.create_or_get(
        kind="quote_notification",
        idempotency_key="quote-notification/quote-test-001",
        recipient="owner@example.com",
        related_quote_id="quote-test-001",
    )

    assert_unique_index(collection, "idempotency_key")
    assert as_document(first) == {
        "id": "delivery-001",
        "kind": "quote_notification",
        "state": "pending",
        "idempotency_key": "quote-notification/quote-test-001",
        "related_quote_id": "quote-test-001",
        "related_inbound_message_id": None,
        "recipient": "owner@example.com",
        "resend_email_id": None,
        "error_code": None,
        "created_at": instant,
        "sent_at": None,
        "updated_at": instant,
    }
    assert as_document(repeated) == as_document(first)
    assert len(collection.documents) == 1


@pytest.mark.asyncio
async def test_delivery_repository_moves_pending_records_to_sent_or_failed():
    from email_inbox import MongoEmailDeliveryRepository

    clock = MutableClock(datetime(2026, 9, 4, 9, tzinfo=timezone.utc))
    identifiers = iter(["delivery-sent", "delivery-failed"])
    collection = AsyncCollection()
    repository = MongoEmailDeliveryRepository(
        collection,
        clock=clock,
        id_factory=lambda: next(identifiers),
    )

    pending_sent = await repository.create_or_get(
        kind="admin_reply",
        idempotency_key="admin-reply/inbound-001/reply-001",
        recipient="sender@example.com",
        related_inbound_message_id="inbound-001",
    )
    clock.value = datetime(2026, 9, 4, 9, 1, tzinfo=timezone.utc)
    sent = await repository.mark_sent(
        as_document(pending_sent)["id"],
        resend_email_id="provider-sent-001",
    )

    clock.value = datetime(2026, 9, 4, 9, 2, tzinfo=timezone.utc)
    pending_failed = await repository.create_or_get(
        kind="inbound_relay",
        idempotency_key="inbound-relay/inbound-002",
        recipient="owner@example.com",
        related_inbound_message_id="inbound-002",
    )
    clock.value = datetime(2026, 9, 4, 9, 3, tzinfo=timezone.utc)
    failed = await repository.mark_failed(
        as_document(pending_failed)["id"],
        error_code="provider_unavailable",
    )

    sent_document = as_document(sent)
    failed_document = as_document(failed)
    persisted_sent = await collection.find_one({"id": sent_document["id"]})
    persisted_failed = await collection.find_one({"id": failed_document["id"]})
    assert persisted_sent == sent_document
    assert persisted_failed == failed_document
    assert {
        "state": persisted_sent["state"],
        "resend_email_id": persisted_sent["resend_email_id"],
        "error_code": persisted_sent["error_code"],
        "sent_at": persisted_sent["sent_at"],
        "updated_at": persisted_sent["updated_at"],
    } == {
        "state": "sent",
        "resend_email_id": "provider-sent-001",
        "error_code": None,
        "sent_at": datetime(2026, 9, 4, 9, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 9, 4, 9, 1, tzinfo=timezone.utc),
    }
    assert {
        "state": persisted_failed["state"],
        "resend_email_id": persisted_failed["resend_email_id"],
        "error_code": persisted_failed["error_code"],
        "sent_at": persisted_failed["sent_at"],
        "updated_at": persisted_failed["updated_at"],
    } == {
        "state": "failed",
        "resend_email_id": None,
        "error_code": "provider_unavailable",
        "sent_at": None,
        "updated_at": datetime(2026, 9, 4, 9, 3, tzinfo=timezone.utc),
    }

    clock.value = datetime(2026, 9, 4, 9, 4, tzinfo=timezone.utc)
    assert (
        await repository.mark_sent(
            sent_document["id"], resend_email_id="provider-must-not-replace"
        )
        is None
    )
    assert (
        await repository.mark_failed(sent_document["id"], error_code="delivery_failed")
        is None
    )
    assert (
        await repository.mark_sent(
            failed_document["id"], resend_email_id="provider-must-not-save"
        )
        is None
    )
    assert (
        await repository.mark_failed(
            failed_document["id"], error_code="provider_rejected"
        )
        is None
    )
    assert await collection.find_one({"id": sent_document["id"]}) == persisted_sent
    assert await collection.find_one({"id": failed_document["id"]}) == persisted_failed


@pytest.mark.asyncio
async def test_inbound_repository_converges_on_unique_provider_and_webhook_ids():
    from email_inbox import MongoInboundMessageRepository

    received_at = datetime(2026, 9, 4, 10, tzinfo=timezone.utc)
    identifiers = iter(
        ["inbound-001", "inbound-must-not-be-used-1", "inbound-must-not-be-used-2"]
    )
    collection = AsyncCollection()
    repository = MongoInboundMessageRepository(
        collection,
        id_factory=lambda: next(identifiers),
    )
    message = {
        "webhook_id": "webhook-001",
        "resend_email_id": "provider-inbound-001",
        "message_id": "<thread-inbound-001@example.com>",
        "references": ["<thread-root@example.com>"],
        "sender": "sender@example.com",
        "recipients": ["contact@inbound.example.com"],
        "subject": "Întrebare de test",
        "text": "Conținut text de test.",
        "html": "<p>Conținut HTML de test.</p>",
        "attachments": [
            {
                "id": "attachment-001",
                "filename": "brief.txt",
                "content_type": "text/plain",
                "size": 12,
            }
        ],
        "category": "contact",
        "received_at": received_at,
    }

    await repository.create_indexes()
    first = await repository.upsert_received(**message)
    same_provider = await repository.upsert_received(**message)
    same_webhook = await repository.upsert_received(**message)

    from email_inbox import InboundIdentityConflict

    with pytest.raises(InboundIdentityConflict):
        await repository.upsert_received(
            **(message | {"webhook_id": "webhook-002", "subject": "Must not replace"})
        )
    with pytest.raises(InboundIdentityConflict):
        await repository.upsert_received(
            **(
                message
                | {
                    "resend_email_id": "provider-inbound-002",
                    "subject": "Must not create",
                }
            )
        )

    assert_unique_index(collection, "resend_email_id")
    assert_unique_index(collection, "webhook_id")
    assert as_document(first)["id"] == "inbound-001"
    assert as_document(same_provider)["id"] == "inbound-001"
    assert as_document(same_webhook)["id"] == "inbound-001"
    assert len(collection.documents) == 1
    assert collection.documents[0]["subject"] == "Întrebare de test"
    assert collection.documents[0]["relay_state"] == "pending"


@pytest.mark.asyncio
async def test_inbound_list_filters_paginates_and_projects_only_safe_admin_fields():
    from email_inbox import MongoInboundMessageRepository

    collection = AsyncCollection(
        [
            inbound_document(
                "inbound-001", datetime(2026, 9, 4, 8, tzinfo=timezone.utc)
            ),
            inbound_document(
                "inbound-002", datetime(2026, 9, 4, 9, tzinfo=timezone.utc)
            ),
            inbound_document(
                "inbound-003",
                datetime(2026, 9, 4, 10, tzinfo=timezone.utc),
                category="other_recipient",
            ),
            inbound_document(
                "inbound-004", datetime(2026, 9, 4, 11, tzinfo=timezone.utc)
            ),
        ]
    )
    repository = MongoInboundMessageRepository(collection)

    first_page = as_document(
        await repository.list(category="contact", page=1, page_size=2)
    )
    second_page = as_document(
        await repository.list(category="contact", page=2, page_size=2)
    )
    other_recipient = as_document(
        await repository.list(category="other_recipient", page=1, page_size=10)
    )
    detail = as_document(await repository.get("inbound-004"))

    summary_projection = {
        "_id": 0,
        "id": 1,
        "from": 1,
        "subject": 1,
        "category": 1,
        "received_at": 1,
        "relay_state": 1,
        "latest_reply_at": 1,
    }
    detail_projection = {
        "_id": 0,
        "id": 1,
        "from": 1,
        "to": 1,
        "subject": 1,
        "text": 1,
        "attachments": 1,
        "category": 1,
        "received_at": 1,
        "relay_state": 1,
        "latest_reply_at": 1,
    }
    assert collection.projections == [
        summary_projection,
        summary_projection,
        summary_projection,
        detail_projection,
    ]

    assert set(first_page) == {"items", "total", "page", "page_size"}
    assert first_page["total"] == 3
    assert first_page["page"] == 1
    assert first_page["page_size"] == 2
    assert [item["id"] for item in first_page["items"]] == [
        "inbound-004",
        "inbound-002",
    ]
    assert [item["id"] for item in second_page["items"]] == ["inbound-001"]
    assert [item["id"] for item in other_recipient["items"]] == ["inbound-003"]

    summary_keys = {
        "id",
        "from",
        "subject",
        "category",
        "received_at",
        "relay_state",
        "latest_reply_at",
    }
    for page in (first_page, second_page, other_recipient):
        for item in page["items"]:
            assert set(item) == summary_keys

    assert set(detail) == {
        "id",
        "from",
        "to",
        "subject",
        "text",
        "attachments",
        "category",
        "received_at",
        "relay_state",
        "latest_reply_at",
    }
    assert detail["id"] == "inbound-004"
    assert detail["from"] == "sender-inbound-004@example.com"
    assert detail["to"] == ["contact@inbound.example.com"]
    assert detail["subject"] == "Subject inbound-004"
    assert detail["text"] == "Text inbound-004"
    assert detail["attachments"] == [
        {
            "id": "attachment-inbound-004",
            "filename": "file-inbound-004.txt",
            "content_type": "text/plain",
            "size": 12,
        }
    ]


@pytest.mark.asyncio
async def test_delivery_repository_indexes_races_and_bounded_related_lookups():
    from email_inbox import MongoEmailDeliveryRepository

    clock = MutableClock(datetime(2026, 9, 4, 12, tzinfo=timezone.utc))
    collection = RacingInsertCollection("delivery-race-winner")
    repository = MongoEmailDeliveryRepository(
        collection,
        clock=clock,
        id_factory=lambda: "delivery-race-loser",
    )

    await repository.create_indexes()
    quote_delivery = await repository.create_or_get(
        kind="quote_notification",
        idempotency_key="quote-notification/quote-001",
        recipient="owner@example.com",
        related_quote_id="quote-001",
    )
    clock.value = datetime(2026, 9, 4, 12, 1, tzinfo=timezone.utc)
    inbound_delivery = await repository.create_or_get(
        kind="inbound_relay",
        idempotency_key="inbound-relay/provider-001",
        recipient="owner@example.com",
        related_inbound_message_id="inbound-001",
    )

    current = await repository.get_current_quote_notification("quote-001")
    related = await repository.list_for_inbound_message("inbound-001")

    assert_unique_index(collection, "id")
    assert_unique_index(collection, "idempotency_key")
    assert_index(
        collection,
        [("related_quote_id", 1), ("created_at", -1)],
    )
    assert_index(
        collection,
        [("related_inbound_message_id", 1), ("created_at", -1)],
    )
    assert_index(collection, [("state", 1), ("updated_at", -1)])
    assert as_document(quote_delivery)["id"] == "delivery-race-winner"
    assert as_document(current)["id"] == "delivery-race-winner"
    assert [as_document(item)["id"] for item in related] == [
        as_document(inbound_delivery)["id"]
    ]
    assert collection.query_timeouts


@pytest.mark.asyncio
async def test_inbound_repository_reserves_then_completes_a_webhook_once():
    from email_inbox import MongoInboundMessageRepository

    instant = datetime(2026, 9, 4, 13, tzinfo=timezone.utc)
    collection = AsyncCollection(require_bounded_queries=True)
    repository = MongoInboundMessageRepository(
        collection,
        clock=lambda: instant,
        id_factory=lambda: "inbound-reserved-001",
    )

    await repository.create_indexes()
    first_reservation = await repository.reserve_webhook_event(
        webhook_id="webhook-reserved-001",
        resend_email_id="provider-reserved-001",
    )
    repeated_reservation = await repository.reserve_webhook_event(
        webhook_id="webhook-reserved-001",
        resend_email_id="provider-reserved-001",
    )
    received = await repository.upsert_received(
        webhook_id="webhook-reserved-001",
        resend_email_id="provider-reserved-001",
        message_id="<reserved@example.com>",
        references=[],
        sender="sender@example.com",
        recipients=["contact@inbound.example.com"],
        subject="Reserved message",
        text="Stored before relay.",
        html="<p>Archived only.</p>",
        attachments=[],
        category="contact",
        received_at=instant,
    )
    completed_reservation = await repository.reserve_webhook_event(
        webhook_id="webhook-reserved-001",
        resend_email_id="provider-reserved-001",
    )

    assert first_reservation is True
    assert repeated_reservation is True
    assert completed_reservation is False
    assert as_document(received)["id"] == "inbound-reserved-001"
    assert collection.documents[0]["ingest_state"] == "received"
    assert len(collection.documents) == 1
    assert collection.query_timeouts


@pytest.mark.asyncio
async def test_inbound_repository_caps_persisted_content_and_wins_insert_race():
    from email_inbox import MongoInboundMessageRepository

    instant = datetime(2026, 9, 4, 14, tzinfo=timezone.utc)
    collection = RacingInsertCollection("inbound-race-winner")
    repository = MongoInboundMessageRepository(
        collection,
        clock=lambda: instant,
        id_factory=lambda: "inbound-race-loser",
    )
    attachments = [
        {
            "id": f"attachment-{index}",
            "filename": "f" * 241,
            "content_type": "text/plain",
            "size": index,
            "download_url": "https://provider.invalid/secret",
        }
        for index in range(51)
    ]

    await repository.create_indexes()
    received = await repository.upsert_received(
        webhook_id="webhook-race-001",
        resend_email_id="provider-race-001",
        message_id="<race@example.com>",
        references=[f"<reference-{index}@example.com>" for index in range(21)],
        sender="SENDER@example.com",
        recipients=["CONTACT@inbound.example.com"],
        subject="s" * 301,
        text="t" * 100_001,
        html="h" * 200_001,
        attachments=attachments,
        category="contact",
        received_at=instant,
    )

    stored = collection.documents[0]
    assert as_document(received)["id"] == "inbound-race-winner"
    assert stored["from"] == "sender@example.com"
    assert stored["to"] == ["contact@inbound.example.com"]
    assert len(stored["subject"]) == 300
    assert len(stored["text"]) == 100_000
    assert len(stored["html"]) == 200_000
    assert len(stored["references"]) == 20
    assert len(stored["attachments"]) == 50
    assert len(stored["attachments"][0]["filename"]) == 240
    assert set(stored["attachments"][0]) == {
        "id",
        "filename",
        "content_type",
        "size",
    }


@pytest.mark.asyncio
async def test_inbound_repository_searches_literal_text_and_updates_relay_reply_state():
    from email_inbox import MongoInboundMessageRepository

    clock = MutableClock(datetime(2026, 9, 4, 15, tzinfo=timezone.utc))
    collection = AsyncCollection(
        [
            inbound_document(
                "inbound-literal",
                datetime(2026, 9, 4, 14, tzinfo=timezone.utc),
                subject="Offer [draft]",
            ),
            inbound_document(
                "inbound-regex-lookalike",
                datetime(2026, 9, 4, 13, tzinfo=timezone.utc),
                subject="Offer d",
            ),
            inbound_document(
                "inbound-failed",
                datetime(2026, 9, 4, 12, tzinfo=timezone.utc),
            ),
        ],
        require_bounded_queries=True,
    )
    repository = MongoInboundMessageRepository(collection, clock=clock)

    searched = as_document(
        await repository.list(q="[draft]", category="contact", page=1, page_size=10)
    )
    relayed = await repository.mark_relay_sent("inbound-literal")
    assert await repository.mark_relay_failed("inbound-literal") is None
    failed = await repository.mark_relay_failed("inbound-failed")
    clock.value = datetime(2026, 9, 4, 15, 1, tzinfo=timezone.utc)
    retried = await repository.mark_relay_pending("inbound-failed")
    replied = await repository.mark_reply_sent("inbound-literal")

    assert [item["id"] for item in searched["items"]] == ["inbound-literal"]
    assert as_document(relayed)["relay_state"] == "sent"
    assert as_document(failed)["relay_state"] == "failed"
    assert as_document(retried)["relay_state"] == "pending"
    assert as_document(replied)["latest_reply_at"] == clock.value
    assert collection.query_timeouts


@pytest.mark.asyncio
async def test_delivery_failure_rejects_non_allowlisted_error_text():
    from email_inbox import MongoEmailDeliveryRepository

    instant = datetime(2026, 9, 4, 16, tzinfo=timezone.utc)
    collection = AsyncCollection()
    repository = MongoEmailDeliveryRepository(
        collection,
        clock=lambda: instant,
        id_factory=lambda: "delivery-safe-error",
    )
    delivery = await repository.create_or_get(
        kind="inbound_relay",
        idempotency_key="inbound-relay/inbound-safe-error",
        recipient="owner@example.com",
        related_inbound_message_id="inbound-safe-error",
    )

    with pytest.raises(ValidationError):
        await repository.mark_failed(
            as_document(delivery)["id"],
            error_code="SMTP rejected secret@example.com",
        )


@pytest.mark.asyncio
async def test_inbound_repository_normalizes_naive_bson_dates_and_bounds_page_offset():
    from email_inbox import MAX_PAGE, MongoInboundMessageRepository

    naive_received_at = datetime(2026, 9, 4, 17)
    collection = AsyncCollection([inbound_document("inbound-naive", naive_received_at)])
    repository = MongoInboundMessageRepository(collection)

    page = await repository.list(page=1, page_size=10)

    assert page.items[0].received_at == naive_received_at.replace(tzinfo=timezone.utc)
    with pytest.raises(ValueError):
        await repository.list(page=MAX_PAGE + 1, page_size=10)


@pytest.mark.asyncio
async def test_inbound_repository_rejects_mismatched_reserved_identity_without_overwrite():
    from email_inbox import InboundIdentityConflict, MongoInboundMessageRepository

    instant = datetime(2026, 9, 4, 18, tzinfo=timezone.utc)
    collection = AsyncCollection()
    repository = MongoInboundMessageRepository(
        collection,
        clock=lambda: instant,
        id_factory=lambda: "inbound-identity-001",
    )
    await repository.create_indexes()

    assert (
        await repository.reserve_webhook_event(
            webhook_id="webhook-identity-001",
            resend_email_id="provider-identity-001",
        )
        is True
    )
    with pytest.raises(InboundIdentityConflict):
        await repository.reserve_webhook_event(
            webhook_id="webhook-identity-001",
            resend_email_id="provider-identity-002",
        )

    with pytest.raises(InboundIdentityConflict):
        await repository.upsert_received(
            webhook_id="webhook-identity-001",
            resend_email_id="provider-identity-002",
            message_id="<identity@example.com>",
            references=[],
            sender="sender@example.com",
            recipients=["contact@inbound.example.com"],
            subject="Must not overwrite",
            text="Must not overwrite",
            html="<p>Must not overwrite</p>",
            attachments=[],
            category="contact",
            received_at=instant,
        )

    assert collection.documents[0]["webhook_id"] == "webhook-identity-001"
    assert collection.documents[0]["resend_email_id"] == "provider-identity-001"


@pytest.mark.asyncio
async def test_inbound_repository_rejects_mismatched_reservation_insert_race():
    from email_inbox import InboundIdentityConflict, MongoInboundMessageRepository

    collection = RacingReserveCollection()
    repository = MongoInboundMessageRepository(
        collection,
        id_factory=lambda: "inbound-race-001",
    )
    await repository.create_indexes()

    with pytest.raises(InboundIdentityConflict):
        await repository.reserve_webhook_event(
            webhook_id="webhook-race-001",
            resend_email_id="provider-race-001",
        )

    assert len(collection.documents) == 1
    assert collection.documents[0]["webhook_id"] == "webhook-race-001"
    assert (
        collection.documents[0]["resend_email_id"] == "provider-reservation-race-other"
    )
