"""Durable MongoDB repositories for outbound delivery and inbound email."""

from __future__ import annotations

import html
import re
import uuid
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timezone
from email.utils import parseaddr
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from resend_email import (
    MAX_ADDRESS_LENGTH,
    MAX_ATTACHMENT_COUNT,
    MAX_ATTACHMENT_FILENAME_LENGTH,
    MAX_ATTACHMENT_ID_LENGTH,
    MAX_ATTACHMENT_SIZE,
    MAX_CONTENT_TYPE_LENGTH,
    MAX_HTML_LENGTH,
    MAX_MESSAGE_ID_LENGTH,
    MAX_RECIPIENTS,
    MAX_REFERENCES,
    MAX_SUBJECT_LENGTH,
    MAX_TEXT_LENGTH,
    ReceivedAttachment,
    ResendError,
)


QUERY_TIMEOUT_MS = 2_000
MAX_IDENTIFIER_LENGTH = 200
MAX_IDEMPOTENCY_KEY_LENGTH = 500
MAX_SEARCH_LENGTH = 200
MAX_PAGE = 1_000
MAX_PAGE_SIZE = 100
MAX_RELATED_DELIVERIES = 100

DeliveryKind = Literal["quote_notification", "inbound_relay", "admin_reply"]
DeliveryState = Literal["pending", "sent", "failed"]
DeliveryErrorCode = Literal[
    "not_configured",
    "provider_rejected",
    "provider_unavailable",
    "delivery_failed",
]
InboundCategory = Literal["contact", "other_recipient"]
InboundIngestState = Literal["reserved", "received"]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


def _bounded_string(value: Any, maximum: int, *, strip: bool = False) -> str:
    if not isinstance(value, str):
        return ""
    normalized = value.strip() if strip else value
    return normalized[:maximum]


def _normalized_address(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    stripped = value.strip()
    _display_name, parsed = parseaddr(stripped)
    return (parsed or stripped).lower()[:MAX_ADDRESS_LENGTH]


def _normalized_addresses(value: Any) -> list[str]:
    if isinstance(value, str):
        values: Sequence[Any] = (value,)
    elif isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        values = value
    else:
        values = ()
    return [
        normalized
        for item in values[:MAX_RECIPIENTS]
        if (normalized := _normalized_address(item))
    ]


def _normalized_references(value: Any) -> list[str]:
    if isinstance(value, str):
        bracketed = re.findall(r"<[^<>]*>", value)
        values: Sequence[Any] = bracketed or value.split()
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        values = value
    else:
        values = ()
    return [
        item.strip()[:MAX_MESSAGE_ID_LENGTH]
        for item in values
        if isinstance(item, str) and item.strip()
    ][:MAX_REFERENCES]


def _attachment_size(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return 0
    return min(max(parsed, 0), MAX_ATTACHMENT_SIZE)


def _normalized_attachments(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        return []
    normalized: list[dict[str, Any]] = []
    for item in value[:MAX_ATTACHMENT_COUNT]:
        if not isinstance(item, Mapping):
            continue
        attachment = ReceivedAttachment(
            id=_bounded_string(item.get("id"), MAX_ATTACHMENT_ID_LENGTH),
            filename=_bounded_string(
                item.get("filename"), MAX_ATTACHMENT_FILENAME_LENGTH
            ),
            content_type=_bounded_string(
                item.get("content_type"), MAX_CONTENT_TYPE_LENGTH
            ),
            size=_attachment_size(item.get("size")),
        )
        normalized.append(attachment.model_dump())
    return normalized


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        # PyMongo returns naive UTC datetimes unless tz_aware is enabled.
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        strict=True,
        populate_by_name=True,
    )


class EmailDelivery(StrictModel):
    id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    kind: DeliveryKind
    state: DeliveryState = "pending"
    idempotency_key: str = Field(min_length=1, max_length=MAX_IDEMPOTENCY_KEY_LENGTH)
    related_quote_id: str | None = Field(default=None, max_length=MAX_IDENTIFIER_LENGTH)
    related_inbound_message_id: str | None = Field(
        default=None, max_length=MAX_IDENTIFIER_LENGTH
    )
    recipient: str = Field(min_length=1, max_length=MAX_ADDRESS_LENGTH)
    resend_email_id: str | None = Field(default=None, max_length=MAX_IDENTIFIER_LENGTH)
    error_code: DeliveryErrorCode | None = None
    created_at: datetime
    sent_at: datetime | None = None
    updated_at: datetime

    @field_validator("created_at", "sent_at", "updated_at")
    @classmethod
    def validate_timestamp(cls, value: datetime | None) -> datetime | None:
        return _aware_utc(value) if value is not None else None


class DeliveryFailure(StrictModel):
    error_code: DeliveryErrorCode


class InboundMessage(StrictModel):
    id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    resend_email_id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    webhook_id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    ingest_state: InboundIngestState = "received"
    message_id: str = Field(default="", max_length=MAX_MESSAGE_ID_LENGTH)
    references: list[str] = Field(default_factory=list, max_length=MAX_REFERENCES)
    sender: str = Field(alias="from", max_length=MAX_ADDRESS_LENGTH)
    recipients: list[str] = Field(
        alias="to", default_factory=list, max_length=MAX_RECIPIENTS
    )
    subject: str = Field(default="", max_length=MAX_SUBJECT_LENGTH)
    text: str = Field(default="", max_length=MAX_TEXT_LENGTH)
    html: str = Field(default="", max_length=MAX_HTML_LENGTH)
    attachments: list[ReceivedAttachment] = Field(
        default_factory=list, max_length=MAX_ATTACHMENT_COUNT
    )
    category: InboundCategory
    received_at: datetime
    relay_state: DeliveryState = "pending"
    relay_error_code: DeliveryErrorCode | None = None
    relay_sent_at: datetime | None = None
    latest_reply_at: datetime | None = None
    reply_count: int = Field(default=0, ge=0)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator(
        "received_at",
        "relay_sent_at",
        "latest_reply_at",
        "created_at",
        "updated_at",
    )
    @classmethod
    def validate_timestamp(cls, value: datetime | None) -> datetime | None:
        return _aware_utc(value) if value is not None else None


class InboundSummary(StrictModel):
    id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    sender: str = Field(alias="from", max_length=MAX_ADDRESS_LENGTH)
    subject: str = Field(default="", max_length=MAX_SUBJECT_LENGTH)
    category: InboundCategory
    received_at: datetime
    relay_state: DeliveryState
    latest_reply_at: datetime | None = None

    @field_validator("received_at", "latest_reply_at")
    @classmethod
    def validate_timestamp(cls, value: datetime | None) -> datetime | None:
        return _aware_utc(value) if value is not None else None


class InboundDetail(InboundSummary):
    recipients: list[str] = Field(
        alias="to", default_factory=list, max_length=MAX_RECIPIENTS
    )
    text: str = Field(default="", max_length=MAX_TEXT_LENGTH)
    attachments: list[ReceivedAttachment] = Field(
        default_factory=list, max_length=MAX_ATTACHMENT_COUNT
    )


class InboundPage(StrictModel):
    items: list[InboundSummary]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=MAX_PAGE_SIZE)


class InboundIdentityConflict(RuntimeError):
    """A webhook/provider ID was already reserved for a different pair."""


class InboundRelayError(RuntimeError):
    """A relay failed with an allowlisted provider error code."""

    def __init__(self, error_code: DeliveryErrorCode):
        self.error_code = error_code
        super().__init__(error_code)


DELIVERY_FIELDS = {"_id": 0, **dict.fromkeys(EmailDelivery.model_fields, 1)}
INBOUND_INTERNAL_FIELDS = {
    "_id": 0,
    "id": 1,
    "resend_email_id": 1,
    "webhook_id": 1,
    "ingest_state": 1,
    "message_id": 1,
    "references": 1,
    "from": 1,
    "to": 1,
    "subject": 1,
    "text": 1,
    "html": 1,
    "attachments": 1,
    "category": 1,
    "received_at": 1,
    "relay_state": 1,
    "relay_error_code": 1,
    "relay_sent_at": 1,
    "latest_reply_at": 1,
    "reply_count": 1,
    "created_at": 1,
    "updated_at": 1,
}
INBOUND_SUMMARY_FIELDS = {
    "_id": 0,
    "id": 1,
    "from": 1,
    "subject": 1,
    "category": 1,
    "received_at": 1,
    "relay_state": 1,
    "latest_reply_at": 1,
}
INBOUND_DETAIL_FIELDS = {
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


def _projection_for(
    model: type[BaseModel], document: Mapping[str, Any]
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for name, field in model.model_fields.items():
        alias = field.alias or name
        if alias in document:
            payload[alias] = document[alias]
        elif name in document:
            payload[name] = document[name]
    return payload


def _delivery(document: Mapping[str, Any] | None) -> EmailDelivery | None:
    if document is None:
        return None
    return EmailDelivery.model_validate(_projection_for(EmailDelivery, document))


def _inbound(document: Mapping[str, Any] | None) -> InboundMessage | None:
    if document is None:
        return None
    return InboundMessage.model_validate(_projection_for(InboundMessage, document))


class MongoEmailDeliveryRepository:
    """Idempotent outbound-delivery state stored in MongoDB."""

    def __init__(
        self,
        collection,
        *,
        clock: Callable[[], datetime] = _utc_now,
        id_factory: Callable[[], str] = _new_id,
    ):
        self.collection = collection
        self.clock = clock
        self.id_factory = id_factory

    async def create_indexes(self) -> None:
        await self.collection.create_index("id", unique=True)
        await self.collection.create_index("idempotency_key", unique=True)
        await self.collection.create_index(
            [("related_quote_id", 1), ("created_at", -1)]
        )
        await self.collection.create_index(
            [("related_inbound_message_id", 1), ("created_at", -1)]
        )
        await self.collection.create_index([("state", 1), ("updated_at", -1)])

    async def _get_by_idempotency_key(
        self, idempotency_key: str
    ) -> EmailDelivery | None:
        document = await self.collection.find_one(
            {"idempotency_key": idempotency_key},
            DELIVERY_FIELDS,
            max_time_ms=QUERY_TIMEOUT_MS,
        )
        return _delivery(document)

    async def create_or_get(
        self,
        *,
        kind: DeliveryKind,
        idempotency_key: str,
        recipient: str,
        related_quote_id: str | None = None,
        related_inbound_message_id: str | None = None,
    ) -> EmailDelivery:
        normalized_key = _bounded_string(
            idempotency_key, MAX_IDEMPOTENCY_KEY_LENGTH, strip=True
        )
        existing = await self._get_by_idempotency_key(normalized_key)
        if existing is not None:
            return existing

        now = _aware_utc(self.clock())
        candidate = EmailDelivery(
            id=_bounded_string(self.id_factory(), MAX_IDENTIFIER_LENGTH, strip=True),
            kind=kind,
            state="pending",
            idempotency_key=normalized_key,
            related_quote_id=(
                _bounded_string(related_quote_id, MAX_IDENTIFIER_LENGTH, strip=True)
                or None
            ),
            related_inbound_message_id=(
                _bounded_string(
                    related_inbound_message_id, MAX_IDENTIFIER_LENGTH, strip=True
                )
                or None
            ),
            recipient=_normalized_address(recipient),
            resend_email_id=None,
            error_code=None,
            created_at=now,
            sent_at=None,
            updated_at=now,
        )
        document = candidate.model_dump(by_alias=True)
        try:
            await self.collection.insert_one(document)
            return candidate
        except DuplicateKeyError:
            winner = await self._get_by_idempotency_key(normalized_key)
            if winner is not None:
                return winner
            raise

    async def mark_sent(
        self, delivery_id: str, *, resend_email_id: str
    ) -> EmailDelivery | None:
        now = _aware_utc(self.clock())
        document = await self.collection.find_one_and_update(
            {
                "id": _bounded_string(delivery_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "state": "pending",
            },
            {
                "$set": {
                    "state": "sent",
                    "resend_email_id": _bounded_string(
                        resend_email_id, MAX_IDENTIFIER_LENGTH, strip=True
                    ),
                    "error_code": None,
                    "sent_at": now,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
            projection=DELIVERY_FIELDS,
            maxTimeMS=QUERY_TIMEOUT_MS,
        )
        return _delivery(document)

    async def mark_failed(
        self,
        delivery_id: str,
        *,
        error_code: DeliveryErrorCode,
    ) -> EmailDelivery | None:
        safe_failure = DeliveryFailure(error_code=error_code)
        now = _aware_utc(self.clock())
        document = await self.collection.find_one_and_update(
            {
                "id": _bounded_string(delivery_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "state": "pending",
            },
            {
                "$set": {
                    "state": "failed",
                    "resend_email_id": None,
                    "error_code": safe_failure.error_code,
                    "sent_at": None,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
            projection=DELIVERY_FIELDS,
            maxTimeMS=QUERY_TIMEOUT_MS,
        )
        return _delivery(document)

    async def get_current_quote_notification(
        self, quote_id: str
    ) -> EmailDelivery | None:
        document = await self.collection.find_one(
            {
                "kind": "quote_notification",
                "related_quote_id": _bounded_string(
                    quote_id, MAX_IDENTIFIER_LENGTH, strip=True
                ),
            },
            DELIVERY_FIELDS,
            sort=[("created_at", -1)],
            max_time_ms=QUERY_TIMEOUT_MS,
        )
        return _delivery(document)

    async def list_for_inbound_message(
        self, inbound_message_id: str
    ) -> list[EmailDelivery]:
        cursor = (
            self.collection.find(
                {
                    "related_inbound_message_id": _bounded_string(
                        inbound_message_id, MAX_IDENTIFIER_LENGTH, strip=True
                    )
                },
                DELIVERY_FIELDS,
            )
            .sort([("created_at", -1)])
            .limit(MAX_RELATED_DELIVERIES)
            .max_time_ms(QUERY_TIMEOUT_MS)
        )
        documents = await cursor.to_list(length=MAX_RELATED_DELIVERIES)
        return [delivery for item in documents if (delivery := _delivery(item))]


class InboundRelayService:
    """Relay a verified inbound message to the owner through one stable key."""

    recipient = "fireartro@gmail.com"

    def __init__(self, resend_client, delivery_repository, inbound_repository):
        self.resend_client = resend_client
        self.delivery_repository = delivery_repository
        self.inbound_repository = inbound_repository

    @staticmethod
    def _message(message: InboundMessage) -> tuple[str, str, str]:
        subject = message.subject or "(fără subiect)"
        text = (
            "Email primit prin FireArtRo\n\n"
            f"De la: {message.sender}\n"
            f"Către: {', '.join(message.recipients)}\n"
            f"Subiect: {subject}\n\n"
            f"{message.text}"
        )
        html_body = (
            "<h1>Email primit prin FireArtRo</h1>"
            f"<p><strong>De la:</strong> {html.escape(message.sender)}</p>"
            f"<p><strong>Către:</strong> {html.escape(', '.join(message.recipients))}</p>"
            f"<p><strong>Subiect:</strong> {html.escape(subject)}</p>"
            f"<pre>{html.escape(message.text)}</pre>"
        )
        return f"Email primit — {subject}", text, html_body

    async def relay(self, message: InboundMessage):
        if self.delivery_repository is None or self.resend_client is None:
            raise InboundRelayError("not_configured")

        key = f"inbound-relay/{message.resend_email_id}"
        delivery = await self.delivery_repository.create_or_get(
            kind="inbound_relay",
            idempotency_key=key,
            recipient=self.recipient,
            related_inbound_message_id=message.id,
        )
        if delivery.state == "sent":
            return delivery
        if delivery.state == "failed":
            raise InboundRelayError(delivery.error_code or "delivery_failed")

        subject, text, html_body = self._message(message)
        try:
            provider_id = await self.resend_client.send(
                to=self.recipient,
                subject=subject,
                text=text,
                html=html_body,
                idempotency_key=key,
                reply_to=message.sender,
            )
        except ResendError as error:
            await self.delivery_repository.mark_failed(
                delivery.id, error_code=error.code
            )
            await self.inbound_repository.mark_relay_failed(
                message.id, error_code=error.code
            )
            raise InboundRelayError(error.code) from None

        await self.delivery_repository.mark_sent(
            delivery.id, resend_email_id=provider_id
        )
        await self.inbound_repository.mark_relay_sent(message.id)
        return delivery


class MongoInboundMessageRepository:
    """Idempotent inbound-message storage with safe Admin read models."""

    def __init__(
        self,
        collection,
        *,
        clock: Callable[[], datetime] = _utc_now,
        id_factory: Callable[[], str] = _new_id,
    ):
        self.collection = collection
        self.clock = clock
        self.id_factory = id_factory

    async def create_indexes(self) -> None:
        await self.collection.create_index("id", unique=True)
        await self.collection.create_index("resend_email_id", unique=True)
        await self.collection.create_index("webhook_id", unique=True)
        await self.collection.create_index([("received_at", -1)])
        await self.collection.create_index([("category", 1), ("received_at", -1)])
        await self.collection.create_index([("from", 1), ("received_at", -1)])

    @staticmethod
    def _identity_query(webhook_id: str, resend_email_id: str) -> dict[str, Any]:
        return {
            "$or": [
                {
                    "webhook_id": _bounded_string(
                        webhook_id, MAX_IDENTIFIER_LENGTH, strip=True
                    )
                },
                {
                    "resend_email_id": _bounded_string(
                        resend_email_id, MAX_IDENTIFIER_LENGTH, strip=True
                    )
                },
            ]
        }

    async def _find_identity(
        self, webhook_id: str, resend_email_id: str
    ) -> dict[str, Any] | None:
        return await self.collection.find_one(
            self._identity_query(webhook_id, resend_email_id),
            INBOUND_INTERNAL_FIELDS,
            max_time_ms=QUERY_TIMEOUT_MS,
        )

    async def reserve_webhook_event(
        self, *, webhook_id: str, resend_email_id: str
    ) -> bool:
        normalized_webhook_id = _bounded_string(
            webhook_id, MAX_IDENTIFIER_LENGTH, strip=True
        )
        normalized_resend_email_id = _bounded_string(
            resend_email_id, MAX_IDENTIFIER_LENGTH, strip=True
        )
        existing = await self._find_identity(webhook_id, resend_email_id)
        if existing is not None:
            if not (
                existing.get("webhook_id") == normalized_webhook_id
                and existing.get("resend_email_id") == normalized_resend_email_id
            ):
                raise InboundIdentityConflict()
            return existing.get("ingest_state", "received") != "received"

        now = _aware_utc(self.clock())
        reservation = {
            "id": _bounded_string(self.id_factory(), MAX_IDENTIFIER_LENGTH, strip=True),
            "webhook_id": normalized_webhook_id,
            "resend_email_id": normalized_resend_email_id,
            "ingest_state": "reserved",
            "created_at": now,
            "updated_at": now,
        }
        try:
            await self.collection.insert_one(reservation)
            return True
        except DuplicateKeyError:
            winner = await self._find_identity(webhook_id, resend_email_id)
            if winner is None:
                raise
            if not (
                winner.get("webhook_id") == normalized_webhook_id
                and winner.get("resend_email_id") == normalized_resend_email_id
            ):
                raise InboundIdentityConflict()
            return winner.get("ingest_state", "received") != "received"

    def _received_document(
        self,
        *,
        identifier: str,
        webhook_id: str,
        resend_email_id: str,
        message_id: str,
        references: Any,
        sender: str,
        recipients: Any,
        subject: str,
        text: str,
        html: str,
        attachments: Any,
        category: InboundCategory,
        received_at: datetime,
        created_at: datetime,
        now: datetime,
    ) -> dict[str, Any]:
        model = InboundMessage(
            id=_bounded_string(identifier, MAX_IDENTIFIER_LENGTH, strip=True),
            resend_email_id=_bounded_string(
                resend_email_id, MAX_IDENTIFIER_LENGTH, strip=True
            ),
            webhook_id=_bounded_string(webhook_id, MAX_IDENTIFIER_LENGTH, strip=True),
            ingest_state="received",
            message_id=_bounded_string(message_id, MAX_MESSAGE_ID_LENGTH, strip=True),
            references=_normalized_references(references),
            sender=_normalized_address(sender),
            recipients=_normalized_addresses(recipients),
            subject=_bounded_string(subject, MAX_SUBJECT_LENGTH),
            text=_bounded_string(text, MAX_TEXT_LENGTH),
            html=_bounded_string(html, MAX_HTML_LENGTH),
            attachments=_normalized_attachments(attachments),
            category=category,
            received_at=_aware_utc(received_at),
            relay_state="pending",
            relay_error_code=None,
            relay_sent_at=None,
            latest_reply_at=None,
            reply_count=0,
            created_at=created_at,
            updated_at=now,
        )
        return model.model_dump(by_alias=True)

    async def upsert_received(
        self,
        *,
        webhook_id: str,
        resend_email_id: str,
        message_id: str,
        references: Any,
        sender: str,
        recipients: Any,
        subject: str,
        text: str,
        html: str,
        attachments: Any,
        category: InboundCategory,
        received_at: datetime,
    ) -> InboundMessage:
        normalized_webhook_id = _bounded_string(
            webhook_id, MAX_IDENTIFIER_LENGTH, strip=True
        )
        normalized_resend_email_id = _bounded_string(
            resend_email_id, MAX_IDENTIFIER_LENGTH, strip=True
        )
        existing = await self._find_identity(
            normalized_webhook_id, normalized_resend_email_id
        )
        if existing is not None and not (
            existing.get("webhook_id") == normalized_webhook_id
            and existing.get("resend_email_id") == normalized_resend_email_id
        ):
            raise InboundIdentityConflict()
        if (
            existing is not None
            and existing.get("ingest_state", "received") == "received"
        ):
            result = _inbound(existing)
            if result is None:
                raise RuntimeError("stored inbound message is unavailable")
            return result

        now = _aware_utc(self.clock())
        identifier = (
            existing.get("id")
            if existing is not None
            else _bounded_string(self.id_factory(), MAX_IDENTIFIER_LENGTH, strip=True)
        )
        created_at = existing.get("created_at", now) if existing is not None else now
        document = self._received_document(
            identifier=identifier,
            webhook_id=normalized_webhook_id,
            resend_email_id=normalized_resend_email_id,
            message_id=message_id,
            references=references,
            sender=sender,
            recipients=recipients,
            subject=subject,
            text=text,
            html=html,
            attachments=attachments,
            category=category,
            received_at=received_at,
            created_at=_aware_utc(created_at),
            now=now,
        )

        if existing is not None:
            saved = await self.collection.find_one_and_update(
                {
                    "id": identifier,
                    "webhook_id": normalized_webhook_id,
                    "resend_email_id": normalized_resend_email_id,
                    "ingest_state": {"$ne": "received"},
                },
                {"$set": document},
                return_document=ReturnDocument.AFTER,
                projection=INBOUND_INTERNAL_FIELDS,
                maxTimeMS=QUERY_TIMEOUT_MS,
            )
            result = _inbound(saved)
            if result is not None:
                return result
            winner = await self._find_identity(webhook_id, resend_email_id)
            if winner is not None and not (
                winner.get("webhook_id") == normalized_webhook_id
                and winner.get("resend_email_id") == normalized_resend_email_id
            ):
                raise InboundIdentityConflict()
            result = _inbound(winner)
            if result is not None:
                return result
            raise RuntimeError("stored inbound message is unavailable")

        try:
            await self.collection.insert_one(document)
            result = _inbound(document)
            if result is None:
                raise RuntimeError("stored inbound message is unavailable")
            return result
        except DuplicateKeyError:
            winner = await self._find_identity(
                normalized_webhook_id, normalized_resend_email_id
            )
            if winner is not None and winner.get("ingest_state") == "received":
                if not (
                    winner.get("webhook_id") == normalized_webhook_id
                    and winner.get("resend_email_id") == normalized_resend_email_id
                ):
                    raise InboundIdentityConflict()
                result = _inbound(winner)
                if result is not None:
                    return result
            if winner is not None and not (
                winner.get("webhook_id") == normalized_webhook_id
                and winner.get("resend_email_id") == normalized_resend_email_id
            ):
                raise InboundIdentityConflict()
            if winner is not None and winner.get("ingest_state") != "received":
                saved = await self.collection.find_one_and_update(
                    {
                        "id": winner.get("id"),
                        "webhook_id": normalized_webhook_id,
                        "resend_email_id": normalized_resend_email_id,
                        "ingest_state": {"$ne": "received"},
                    },
                    {
                        "$set": document
                        | {
                            "id": winner.get("id"),
                            "created_at": winner.get(
                                "created_at", document["created_at"]
                            ),
                        }
                    },
                    return_document=ReturnDocument.AFTER,
                    projection=INBOUND_INTERNAL_FIELDS,
                    maxTimeMS=QUERY_TIMEOUT_MS,
                )
                winner = saved or winner
            result = _inbound(winner)
            if result is not None:
                return result
            raise

    async def list(
        self,
        *,
        q: str = "",
        category: InboundCategory | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> InboundPage:
        if page < 1 or page > MAX_PAGE or page_size < 1 or page_size > MAX_PAGE_SIZE:
            raise ValueError("invalid pagination")
        query: dict[str, Any] = {"ingest_state": {"$ne": "reserved"}}
        if category is not None:
            query["category"] = category
        search = _bounded_string(q, MAX_SEARCH_LENGTH, strip=True)
        if search:
            query["$or"] = [
                {"from": {"$regex": re.escape(search), "$options": "i"}},
                {"subject": {"$regex": re.escape(search), "$options": "i"}},
            ]

        total = await self.collection.count_documents(query, maxTimeMS=QUERY_TIMEOUT_MS)
        cursor = (
            self.collection.find(query, INBOUND_SUMMARY_FIELDS)
            .sort([("received_at", -1), ("id", -1)])
            .skip((page - 1) * page_size)
            .limit(page_size)
            .max_time_ms(QUERY_TIMEOUT_MS)
        )
        documents = await cursor.to_list(length=page_size)
        items = [InboundSummary.model_validate(item) for item in documents]
        return InboundPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get(self, message_id: str) -> InboundDetail | None:
        document = await self.collection.find_one(
            {
                "id": _bounded_string(message_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "ingest_state": {"$ne": "reserved"},
            },
            INBOUND_DETAIL_FIELDS,
            max_time_ms=QUERY_TIMEOUT_MS,
        )
        return InboundDetail.model_validate(document) if document is not None else None

    async def get_internal(self, message_id: str) -> InboundMessage | None:
        """Return bounded private fields needed by authenticated relay/reply services."""

        document = await self.collection.find_one(
            {
                "id": _bounded_string(message_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "ingest_state": {"$ne": "reserved"},
            },
            INBOUND_INTERNAL_FIELDS,
            max_time_ms=QUERY_TIMEOUT_MS,
        )
        return _inbound(document)

    async def _transition_relay(
        self,
        message_id: str,
        *,
        from_state: DeliveryState,
        to_state: DeliveryState,
        error_code: DeliveryErrorCode | None,
    ) -> InboundMessage | None:
        safe_error = (
            DeliveryFailure(error_code=error_code).error_code
            if error_code is not None
            else None
        )
        now = _aware_utc(self.clock())
        values: dict[str, Any] = {
            "relay_state": to_state,
            "relay_error_code": safe_error,
            "updated_at": now,
        }
        if to_state == "sent":
            values["relay_sent_at"] = now
        elif to_state == "pending":
            values["relay_sent_at"] = None
        document = await self.collection.find_one_and_update(
            {
                "id": _bounded_string(message_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "relay_state": from_state,
            },
            {"$set": values},
            return_document=ReturnDocument.AFTER,
            projection=INBOUND_INTERNAL_FIELDS,
            maxTimeMS=QUERY_TIMEOUT_MS,
        )
        return _inbound(document)

    async def mark_relay_sent(self, message_id: str) -> InboundMessage | None:
        return await self._transition_relay(
            message_id,
            from_state="pending",
            to_state="sent",
            error_code=None,
        )

    async def mark_relay_failed(
        self,
        message_id: str,
        *,
        error_code: DeliveryErrorCode = "delivery_failed",
    ) -> InboundMessage | None:
        return await self._transition_relay(
            message_id,
            from_state="pending",
            to_state="failed",
            error_code=error_code,
        )

    async def mark_relay_pending(self, message_id: str) -> InboundMessage | None:
        return await self._transition_relay(
            message_id,
            from_state="failed",
            to_state="pending",
            error_code=None,
        )

    async def mark_reply_sent(self, message_id: str) -> InboundMessage | None:
        now = _aware_utc(self.clock())
        document = await self.collection.find_one_and_update(
            {
                "id": _bounded_string(message_id, MAX_IDENTIFIER_LENGTH, strip=True),
                "ingest_state": {"$ne": "reserved"},
            },
            {
                "$set": {"latest_reply_at": now, "updated_at": now},
                "$inc": {"reply_count": 1},
            },
            return_document=ReturnDocument.AFTER,
            projection=INBOUND_INTERNAL_FIELDS,
            maxTimeMS=QUERY_TIMEOUT_MS,
        )
        return _inbound(document)
