"""Contract tests for durable outbound delivery and inbound inbox storage."""

import asyncio
import re
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
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
    def __init__(self, documents):
        self.documents = documents

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
        return self

    async def to_list(self, length):
        await asyncio.sleep(0)
        return deepcopy(self.documents[:length])


class AsyncCollection:
    """Small Motor-shaped collection with real uniqueness and projections."""

    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))
        self.indexes = []
        self.unique_indexes = []
        self.projections = []

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

    async def find_one(self, query, projection=None):
        await asyncio.sleep(0)
        self.projections.append(deepcopy(projection))
        found = next((item for item in self.documents if matches(item, query)), None)
        return project(found, projection)

    def find(self, query, projection=None):
        self.projections.append(deepcopy(projection))
        return Cursor(
            [
                project(item, projection)
                for item in self.documents
                if matches(item, query)
            ]
        )

    async def count_documents(self, query, **kwargs):
        if "maxTimeMS" in kwargs:
            assert 0 < kwargs["maxTimeMS"] <= 2_000
        return sum(matches(item, query) for item in self.documents)

    async def find_one_and_update(
        self,
        query,
        update,
        *,
        return_document=ReturnDocument.BEFORE,
        projection=None,
        upsert=False,
    ):
        await asyncio.sleep(0)
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


def as_document(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
    return deepcopy(value)


def assert_unique_index(collection, field):
    assert (field,) in collection.unique_indexes


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
    assert {
        "state": sent_document["state"],
        "resend_email_id": sent_document["resend_email_id"],
        "error_code": sent_document["error_code"],
        "sent_at": sent_document["sent_at"],
        "updated_at": sent_document["updated_at"],
    } == {
        "state": "sent",
        "resend_email_id": "provider-sent-001",
        "error_code": None,
        "sent_at": datetime(2026, 9, 4, 9, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 9, 4, 9, 1, tzinfo=timezone.utc),
    }
    assert {
        "state": failed_document["state"],
        "resend_email_id": failed_document["resend_email_id"],
        "error_code": failed_document["error_code"],
        "sent_at": failed_document["sent_at"],
        "updated_at": failed_document["updated_at"],
    } == {
        "state": "failed",
        "resend_email_id": None,
        "error_code": "provider_unavailable",
        "sent_at": None,
        "updated_at": datetime(2026, 9, 4, 9, 3, tzinfo=timezone.utc),
    }


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
    same_provider = await repository.upsert_received(
        **(message | {"webhook_id": "webhook-002", "subject": "Must not replace"})
    )
    same_webhook = await repository.upsert_received(
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

    assert first_page["total"] == 3
    assert first_page["page"] == 1
    assert first_page["page_size"] == 2
    assert [item["id"] for item in first_page["items"]] == [
        "inbound-004",
        "inbound-002",
    ]
    assert [item["id"] for item in second_page["items"]] == ["inbound-001"]
    assert [item["id"] for item in other_recipient["items"]] == ["inbound-003"]

    for item in first_page["items"]:
        for private in (
            "text",
            "html",
            "attachments",
            "message_id",
            "references",
            "resend_email_id",
            "webhook_id",
            "raw_provider_payload",
            "private_secret",
            "_id",
        ):
            assert private not in item

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
    for private in (
        "html",
        "message_id",
        "references",
        "resend_email_id",
        "webhook_id",
        "raw_provider_payload",
        "private_secret",
        "_id",
    ):
        assert private not in detail
