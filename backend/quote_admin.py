"""Private quote inbox; server.py owns mounting and public submission wiring.

Mount create_quote_admin_router(MongoQuoteRepository(db.quotes)). Call both
repositories' create_indexes() during startup. Public submissions may call
await MongoQuoteRateLimiter(db.quote_rate_limits, ADMIN_SESSION_SECRET).enforce(ip)
before honeypot processing; return only an acknowledgement to public callers.
Never serialize QuoteDetail or Mongo documents through a public route.
"""

import hashlib
import html
import hmac
import math
import re
from datetime import datetime, timedelta, timezone
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import require_admin_session
from email_inbox import DeliveryState, DeliveryErrorCode, EmailDelivery, MongoEmailDeliveryRepository
from resend_email import ResendError

QuoteStatus = Literal["new", "contacted", "qualified", "closed", "spam"]
QUOTE_WRITE_MAX_BYTES = 32 * 1024
UNAVAILABLE = "Cererile nu sunt disponibile momentan."
NOTIFICATION_FROM = "FireArtRo <contact@fireart.ro>"
NOTIFICATION_TO = "fireartro@gmail.com"
NOTIFICATION_LEASE = timedelta(minutes=2)
# Resend retains keys for 24 hours; leave room for clock skew/send duration.
NOTIFICATION_RETRY_WINDOW = timedelta(hours=23)


def _error(status, message, **headers):
    return HTTPException(
        status, message, headers={"Cache-Control": "no-store", **headers}
    )


class QuoteSummary(BaseModel):
    # Explicit allowlist: list responses omit contact details, messages and notes.
    id: str
    first_name: str
    last_name: str
    locality: str
    event_type: str
    event_date: str
    package_id: str = ""
    package_title: str = ""
    status: QuoteStatus = "new"
    created_at: datetime


class QuoteNotification(BaseModel):
    state: DeliveryState
    error_code: DeliveryErrorCode | None = None
    sent_at: datetime | None = None
    failed_at: datetime | None = None
    retryable: bool = False
    recovery_required: bool = False


class QuoteDetail(QuoteSummary):
    phone: str
    email: str
    event_location: str = ""
    services: list[str] = Field(default_factory=list)
    message: str = ""
    internal_note: str = ""
    version: int = 0  # legacy submissions gain version 1 on their first CAS update
    updated_at: datetime | None = None
    notification: QuoteNotification | None = None


class QuoteAdminUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    version: int = Field(ge=0, le=2**53 - 1)
    status: QuoteStatus | None = None
    internal_note: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def changed_fields(self):
        changed = self.model_fields_set - {"version"}
        if not changed or any(getattr(self, key) is None for key in changed):
            raise ValueError("Specify a status or note; null is not a change.")
        return self


SUMMARY_FIELDS = {"_id": 0, **dict.fromkeys(QuoteSummary.model_fields, 1)}
DETAIL_FIELDS = {"_id": 0, **dict.fromkeys(QuoteDetail.model_fields, 1)}


class MongoQuoteRepository:
    def __init__(self, collection, delivery_repository=None):
        self.collection = collection
        self.delivery_repository = delivery_repository

    def _ready(self):
        if self.collection is None:
            raise _error(503, UNAVAILABLE)

    async def create_indexes(self):
        self._ready()
        await self.collection.create_index("id", unique=True)
        await self.collection.create_index([("created_at", -1), ("id", -1)])
        await self.collection.create_index(
            [("status", 1), ("created_at", -1), ("id", -1)]
        )

    async def list(self, *, status=None, q="", page=1, page_size=25):
        self._ready()
        query = {"status": status} if status else {}
        if q.strip():
            literal = {"$regex": re.escape(q.strip()), "$options": "i"}
            query["$or"] = [
                {key: literal}
                for key in (
                    "first_name",
                    "last_name",
                    "locality",
                    "event_type",
                    "package_title",
                )
            ]
        try:
            total = await self.collection.count_documents(query, maxTimeMS=2000)
            documents = await (
                self.collection.find(query, SUMMARY_FIELDS)
                .sort([("created_at", -1), ("id", -1)])
                .skip((page - 1) * page_size)
                .limit(page_size)
                .max_time_ms(2000)
                .to_list(page_size)
            )
            return {
                "items": [
                    QuoteSummary.model_validate(d).model_dump(mode="json")
                    for d in documents
                ],
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None

    async def get(self, quote_id):
        self._ready()
        try:
            document = await self.collection.find_one({"id": quote_id}, DETAIL_FIELDS)
            if document is None:
                raise _error(404, "Cererea nu a fost găsită.")
            detail = QuoteDetail.model_validate(document)
            if self.delivery_repository is not None:
                delivery = (
                    await self.delivery_repository.get_current_quote_notification(
                        detail.id
                    )
                )
                detail = detail.model_copy(
                    update={"notification": _safe_notification(delivery, self._notification_now())}
                )
            return detail
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None

    async def update(self, quote_id, change):
        self._ready()
        query = {"id": quote_id}
        if change.version == 0:
            query["$or"] = [{"version": 0}, {"version": {"$exists": False}}]
        else:
            query["version"] = change.version
        changes = change.model_dump(exclude_unset=True, exclude={"version"})
        changes["updated_at"] = datetime.now(timezone.utc)
        try:
            document = await self.collection.find_one_and_update(
                query,
                {"$set": changes, "$inc": {"version": 1}},
                return_document=ReturnDocument.AFTER,
                projection=DETAIL_FIELDS,
            )
            if document is None:
                await self.get(
                    quote_id
                )  # distinguish deleted records from stale editors
                raise _error(
                    409,
                    "Cererea are o versiune mai nouă. Reîncarcă înainte de salvare.",
                )
            detail = QuoteDetail.model_validate(document)
            if self.delivery_repository is not None:
                delivery = (
                    await self.delivery_repository.get_current_quote_notification(
                        detail.id
                    )
                )
                detail = detail.model_copy(
                    update={"notification": _safe_notification(delivery, self._notification_now())}
                )
            return detail
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None


    def _notification_now(self):
        clock = getattr(self.delivery_repository, "clock", None)
        return clock() if callable(clock) else datetime.now(timezone.utc)


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _notification_policy(delivery, now):
    if delivery.state == "sent":
        return False, False
    now = _utc(now)
    first = getattr(delivery, "first_attempt_at", None) or getattr(delivery, "updated_at", None)
    recovery_required = bool(
        first and now - _utc(first) >= NOTIFICATION_RETRY_WINDOW
        and getattr(delivery, "error_code", None) != "not_configured"
    )
    if recovery_required:
        return False, True
    if delivery.state == "failed":
        return True, False
    expiry = getattr(delivery, "lease_expires_at", None)
    if expiry is None:
        updated = getattr(delivery, "updated_at", None)
        return bool(updated and now - _utc(updated) >= NOTIFICATION_LEASE), False
    return _utc(expiry) <= now, False


def _safe_notification(delivery: Any, now=None) -> QuoteNotification | None:
    if delivery is None:
        return None
    state = getattr(delivery, "state", None)
    error_code = getattr(delivery, "error_code", None)
    sent_at = getattr(delivery, "sent_at", None)
    updated_at = getattr(delivery, "updated_at", None)
    retryable, recovery_required = _notification_policy(delivery, now or datetime.now(timezone.utc))
    if error_code not in {None, "not_configured", "provider_rejected", "provider_unavailable", "delivery_failed"}:
        error_code = "delivery_failed"
    return QuoteNotification(
        state=state,
        error_code=error_code,
        sent_at=sent_at,
        failed_at=updated_at if state == "failed" else None,
        retryable=retryable,
        recovery_required=recovery_required,
    )


class QuoteDelivery(EmailDelivery):
    lease_token: str | None = None
    lease_expires_at: datetime | None = None
    first_attempt_at: datetime | None = None

    @field_validator("lease_expires_at", "first_attempt_at")
    @classmethod
    def aware_timestamp(cls, value):
        return _utc(value) if value is not None else None


QUOTE_DELIVERY_FIELDS = {"_id": 0, **dict.fromkeys(QuoteDelivery.model_fields, 1)}


class MongoQuoteDeliveryRepository(MongoEmailDeliveryRepository):
    """Quote-only leases; inherited inbound/reply methods remain compatible."""

    async def get_current_quote_notification(self, quote_id):
        document = await self.collection.find_one(
            {"kind": "quote_notification", "related_quote_id": quote_id},
            QUOTE_DELIVERY_FIELDS, max_time_ms=2000,
        )
        return QuoteDelivery.model_validate(document) if document else None

    async def claim_notification(self, delivery_id, *, allow_unstarted=False):
        document = await self.collection.find_one(
            {"id": delivery_id, "kind": "quote_notification"},
            QUOTE_DELIVERY_FIELDS, max_time_ms=2000,
        )
        if document is None:
            return None
        delivery = QuoteDelivery.model_validate(document)
        now = _utc(self.clock())
        retryable, recovery_required = _notification_policy(delivery, now)
        unstarted = allow_unstarted and delivery.state == "pending" and delivery.lease_token is None
        if recovery_required or (not retryable and not unstarted):
            return None
        # CAS the fields which determined eligibility; competing claims and
        # completions change them and cannot both win.
        query = {"id": delivery_id, "kind": "quote_notification", "state": delivery.state,
                 "updated_at": document["updated_at"], "lease_token": document.get("lease_token")}
        first_attempt = delivery.first_attempt_at
        if first_attempt is None:
            first_attempt = now if unstarted or delivery.error_code == "not_configured" else delivery.updated_at
        claimed = await self.collection.find_one_and_update(
            query,
            {"$set": {"state": "pending", "error_code": None,
                      "lease_token": str(uuid.uuid4()), "lease_expires_at": now + NOTIFICATION_LEASE,
                      "first_attempt_at": first_attempt, "updated_at": now}},
            return_document=ReturnDocument.AFTER, projection=QUOTE_DELIVERY_FIELDS, maxTimeMS=2000,
        )
        return QuoteDelivery.model_validate(claimed) if claimed else None

    async def complete_notification(self, delivery_id, lease_token, *, resend_email_id=None, error_code=None):
        now = _utc(self.clock())
        changes = {"state": "failed" if error_code else "sent", "error_code": error_code,
                   "resend_email_id": resend_email_id, "sent_at": None if error_code else now,
                   "updated_at": now}
        if error_code == "not_configured":
            changes["first_attempt_at"] = None  # transport made no provider request
        document = await self.collection.find_one_and_update(
            {"id": delivery_id, "kind": "quote_notification", "state": "pending", "lease_token": lease_token},
            {"$set": changes, "$unset": {"lease_token": "", "lease_expires_at": ""}},
            return_document=ReturnDocument.AFTER, projection=QUOTE_DELIVERY_FIELDS, maxTimeMS=2000,
        )
        return QuoteDelivery.model_validate(document) if document else None


class QuoteNotificationService:
    """Persist one idempotent quote delivery and contain only safe provider errors."""

    def __init__(self, resend_client, delivery_repository):
        self.resend_client = resend_client
        self.delivery_repository = delivery_repository

    async def current(self, quote_id):
        if self.delivery_repository is None:
            return None
        return await self.delivery_repository.get_current_quote_notification(quote_id)

    @staticmethod
    def _quote_value(quote, name: str) -> str:
        value = (
            quote.get(name, "") if isinstance(quote, dict) else getattr(quote, name, "")
        )
        return value if isinstance(value, str) else str(value)

    def _message(self, quote):
        first_name = self._quote_value(quote, "first_name")
        last_name = self._quote_value(quote, "last_name")
        fields = (
            ("Nume", f"{first_name} {last_name}".strip()),
            ("Email", self._quote_value(quote, "email")),
            ("Telefon", self._quote_value(quote, "phone")),
            ("Localitate", self._quote_value(quote, "locality")),
            ("Locație eveniment", self._quote_value(quote, "event_location")),
            ("Tip eveniment", self._quote_value(quote, "event_type")),
            ("Data eveniment", self._quote_value(quote, "event_date")),
            (
                "Servicii",
                (
                    ", ".join(quote.services)
                    if hasattr(quote, "services")
                    else ", ".join(quote.get("services", []))
                ),
            ),
            ("Pachet", self._quote_value(quote, "package_title")),
            ("Mesaj", self._quote_value(quote, "message")),
        )
        text = "Solicitare ofertă nouă\n\n" + "\n".join(
            f"{label}: {value}" for label, value in fields
        )
        html_body = (
            "<h1>Solicitare ofertă nouă</h1><dl>"
            + "".join(
                f"<dt>{html.escape(label)}</dt><dd>{html.escape(value)}</dd>"
                for label, value in fields
            )
            + "</dl>"
        )
        subject = f"Solicitare ofertă nouă — {first_name} {last_name}".strip()
        return subject, text, html_body

    async def _deliver(self, quote, *, retry: bool):
        if self.delivery_repository is None or self.resend_client is None:
            return None
        quote_id = self._quote_value(quote, "id")
        existing = await self.current(quote_id)
        if existing is not None and not retry:
            return existing
        delivery = existing or await self.delivery_repository.create_or_get(
            kind="quote_notification",
            idempotency_key=f"quote-notification/{quote_id}",
            recipient=NOTIFICATION_TO,
            related_quote_id=quote_id,
        )
        if delivery.state == "sent":
            raise _error(409, "Notificarea a fost deja trimisă.")
        delivery = await self.delivery_repository.claim_notification(
            delivery.id, allow_unstarted=existing is None,
        )
        if delivery is None:
            raise _error(409, "Notificarea este în curs sau necesită verificare manuală înainte de retrimitere.")

        subject, text, html_body = self._message(quote)
        try:
            provider_id = await self.resend_client.send(
                to=NOTIFICATION_TO,
                subject=subject,
                text=text,
                html=html_body,
                idempotency_key=f"quote-notification/{quote_id}",
                reply_to=self._quote_value(quote, "email"),
            )
        except ResendError as error:
            return await self.delivery_repository.complete_notification(
                delivery.id, delivery.lease_token, error_code=error.code
            )
        return await self.delivery_repository.complete_notification(
            delivery.id, delivery.lease_token, resend_email_id=provider_id
        )

    async def notify(self, quote):
        return await self._deliver(quote, retry=False)

    async def retry(self, quote):
        return await self._deliver(quote, retry=True)


def create_quote_admin_router(repository, notification_service=None):
    router = APIRouter(
        prefix="/api/admin/quotes",
        tags=["admin-quotes"],
        dependencies=[Depends(require_admin_session)],
    )

    def response(payload):
        return JSONResponse(payload, headers={"Cache-Control": "no-store"})

    @router.get("")
    async def list_quotes(
        status: QuoteStatus | None = None,
        q: str = Query(default="", max_length=120),
        page: int = Query(default=1, ge=1, le=1000),
        page_size: int = Query(default=25, ge=1, le=100),
    ):
        return response(
            await repository.list(status=status, q=q, page=page, page_size=page_size)
        )

    @router.get("/{quote_id}")
    async def get_quote(
        quote_id: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"),
    ):
        return response((await repository.get(quote_id)).model_dump(mode="json"))

    @router.patch("/{quote_id}")
    async def update_quote(
        request: Request,
        quote_id: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"),
    ):
        # Parse after session/CSRF verification; never echo a private note in errors.
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > QUOTE_WRITE_MAX_BYTES:
                raise _error(413, "Cererea este prea mare.")
            body.extend(chunk)
        try:
            change = QuoteAdminUpdate.model_validate_json(bytes(body))
        except ValidationError:
            raise _error(
                422,
                "Status, notă sau versiune invalidă. Nota poate avea cel mult 4000 de caractere.",
            ) from None
        return response(
            (await repository.update(quote_id, change)).model_dump(mode="json")
        )

    @router.post("/{quote_id}/notification/retry")
    async def retry_quote_notification(
        quote_id: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"),
    ):
        if notification_service is None:
            raise _error(503, UNAVAILABLE)
        detail = await repository.get(quote_id)
        existing = await notification_service.current(quote_id)
        if existing is not None:
            if existing.state == "sent":
                raise _error(409, "Notificarea a fost deja trimisă.")
        try:
            await notification_service.retry(detail)
        except PyMongoError:
            raise _error(503, UNAVAILABLE) from None
        return response((await repository.get(quote_id)).model_dump(mode="json"))

    return router


class MongoQuoteRateLimiter:
    """Five submissions per fixed ten-minute window, shared across processes.

    Mongo's unique _id makes increments atomic. Expiry selects a fresh bucket
    even when TTL cleanup is delayed. IP addresses are stored only as an HMAC.
    """

    def __init__(self, collection, secret, *, clock=lambda: datetime.now(timezone.utc)):
        self.collection, self.secret, self.clock = collection, secret, clock

    async def create_indexes(self):
        if self.collection is None:
            raise _error(503, UNAVAILABLE)
        await self.collection.create_index("expires_at", expireAfterSeconds=0)

    async def enforce(self, client_ip):
        if self.collection is None or not self.secret:
            raise _error(503, UNAVAILABLE)
        now = self.clock().timestamp()
        window = math.floor(now / 600)
        expires_at = datetime.fromtimestamp((window + 1) * 600, tz=timezone.utc)
        digest = hmac.new(
            self.secret.encode(), ("quote-ip:" + client_ip).encode(), hashlib.sha256
        ).hexdigest()
        query = {"_id": f"{digest}:{window}"}
        update = {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}}
        try:
            try:
                document = await self.collection.find_one_and_update(
                    query,
                    update,
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                )
            except DuplicateKeyError:
                # Another function inserted this bucket between the match and upsert.
                document = await self.collection.find_one_and_update(
                    query,
                    {"$inc": {"count": 1}},
                    return_document=ReturnDocument.AFTER,
                )
            if document is None:
                raise _error(503, UNAVAILABLE)
            if document["count"] > 5:
                raise _error(
                    429,
                    "Prea multe solicitări. Încearcă din nou mai târziu.",
                    **{
                        "Retry-After": str(
                            max(1, math.ceil(expires_at.timestamp() - now))
                        ),
                    },
                )
        except PyMongoError:
            raise _error(503, UNAVAILABLE) from None
