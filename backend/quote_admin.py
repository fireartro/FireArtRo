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
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import require_admin_session
from email_inbox import DeliveryState, MongoEmailDeliveryRepository
from resend_email import ResendError

QuoteStatus = Literal["new", "contacted", "qualified", "closed", "spam"]
QUOTE_WRITE_MAX_BYTES = 32 * 1024
UNAVAILABLE = "Cererile nu sunt disponibile momentan."
NOTIFICATION_FROM = "FireArtRo <contact@fireart.ro>"
NOTIFICATION_TO = "fireartro@gmail.com"


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
    error_code: str | None = None
    sent_at: datetime | None = None
    failed_at: datetime | None = None


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
                    update={"notification": _safe_notification(delivery)}
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
                    update={"notification": _safe_notification(delivery)}
                )
            return detail
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None


def _safe_notification(delivery: Any) -> QuoteNotification | None:
    if delivery is None:
        return None
    state = getattr(delivery, "state", None)
    error_code = getattr(delivery, "error_code", None)
    sent_at = getattr(delivery, "sent_at", None)
    updated_at = getattr(delivery, "updated_at", None)
    return QuoteNotification(
        state=state,
        error_code=error_code,
        sent_at=sent_at,
        failed_at=updated_at if state == "failed" else None,
    )


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

    async def _reset_failed(self, delivery):
        resetter = getattr(self.delivery_repository, "reset_failed", None)
        if callable(resetter):
            return await resetter(delivery.id)

        collection = getattr(self.delivery_repository, "collection", None)
        if collection is None:
            return None
        clock = getattr(self.delivery_repository, "clock", None)
        now = clock() if callable(clock) else datetime.now(timezone.utc)
        await collection.find_one_and_update(
            {"id": delivery.id, "state": "failed"},
            {
                "$set": {
                    "state": "pending",
                    "error_code": None,
                    "sent_at": None,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return await self.current(delivery.related_quote_id)

    async def _deliver(self, quote, *, retry: bool):
        if self.delivery_repository is None or self.resend_client is None:
            return None
        quote_id = self._quote_value(quote, "id")
        delivery = await self.delivery_repository.create_or_get(
            kind="quote_notification",
            idempotency_key=f"quote-notification/{quote_id}",
            recipient=NOTIFICATION_TO,
            related_quote_id=quote_id,
        )
        if delivery.state == "sent":
            return delivery
        if delivery.state == "failed":
            if not retry:
                return delivery
            delivery = await self._reset_failed(delivery)
            if delivery is None or delivery.state != "pending":
                return delivery

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
            return await self.delivery_repository.mark_failed(
                delivery.id, error_code=error.code
            )
        return await self.delivery_repository.mark_sent(
            delivery.id, resend_email_id=provider_id
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
            if existing.state != "failed":
                raise _error(409, "Notificarea este deja în curs de trimitere.")
        await notification_service.retry(detail)
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
