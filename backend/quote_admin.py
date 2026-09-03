"""Private quote inbox; server.py owns mounting and public submission wiring.

Mount create_quote_admin_router(MongoQuoteRepository(db.quotes)). Call both
repositories' create_indexes() during startup. Public submissions may call
await MongoQuoteRateLimiter(db.quote_rate_limits, ADMIN_SESSION_SECRET).enforce(ip)
before honeypot processing; return only an acknowledgement to public callers.
Never serialize QuoteDetail or Mongo documents through a public route.
"""

import hashlib
import hmac
import math
import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import require_admin_session

QuoteStatus = Literal["new", "contacted", "qualified", "closed", "spam"]
QUOTE_WRITE_MAX_BYTES = 32 * 1024
UNAVAILABLE = "Cererile nu sunt disponibile momentan."


def _error(status, message, **headers):
    return HTTPException(status, message, headers={"Cache-Control": "no-store", **headers})


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


class QuoteDetail(QuoteSummary):
    phone: str
    email: str
    event_location: str = ""
    services: list[str] = Field(default_factory=list)
    message: str = ""
    internal_note: str = ""
    version: int = 0  # legacy submissions gain version 1 on their first CAS update
    updated_at: datetime | None = None


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
    def __init__(self, collection):
        self.collection = collection

    def _ready(self):
        if self.collection is None:
            raise _error(503, UNAVAILABLE)

    async def create_indexes(self):
        self._ready()
        await self.collection.create_index("id", unique=True)
        await self.collection.create_index([("created_at", -1), ("id", -1)])
        await self.collection.create_index([("status", 1), ("created_at", -1), ("id", -1)])

    async def list(self, *, status=None, q="", page=1, page_size=25):
        self._ready()
        query = {"status": status} if status else {}
        if q.strip():
            literal = {"$regex": re.escape(q.strip()), "$options": "i"}
            query["$or"] = [{key: literal} for key in (
                "first_name", "last_name", "locality", "event_type", "package_title",
            )]
        try:
            total = await self.collection.count_documents(query, maxTimeMS=2000)
            documents = await (
                self.collection.find(query, SUMMARY_FIELDS)
                .sort([("created_at", -1), ("id", -1)])
                .skip((page - 1) * page_size).limit(page_size).max_time_ms(2000)
                .to_list(page_size)
            )
            return {
                "items": [QuoteSummary.model_validate(d).model_dump(mode="json") for d in documents],
                "total": total, "page": page, "page_size": page_size,
            }
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None

    async def get(self, quote_id):
        self._ready()
        try:
            document = await self.collection.find_one({"id": quote_id}, DETAIL_FIELDS)
            if document is None:
                raise _error(404, "Cererea nu a fost găsită.")
            return QuoteDetail.model_validate(document)
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
                query, {"$set": changes, "$inc": {"version": 1}},
                return_document=ReturnDocument.AFTER, projection=DETAIL_FIELDS,
            )
            if document is None:
                await self.get(quote_id)  # distinguish deleted records from stale editors
                raise _error(409, "Cererea are o versiune mai nouă. Reîncarcă înainte de salvare.")
            return QuoteDetail.model_validate(document)
        except (PyMongoError, ValidationError):
            raise _error(503, UNAVAILABLE) from None


def create_quote_admin_router(repository):
    router = APIRouter(
        prefix="/api/admin/quotes", tags=["admin-quotes"],
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
        return response(await repository.list(status=status, q=q, page=page, page_size=page_size))

    @router.get("/{quote_id}")
    async def get_quote(quote_id: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")):
        return response((await repository.get(quote_id)).model_dump(mode="json"))

    @router.patch("/{quote_id}")
    async def update_quote(request: Request, quote_id: str = Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")):
        # Parse after session/CSRF verification; never echo a private note in errors.
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > QUOTE_WRITE_MAX_BYTES:
                raise _error(413, "Cererea este prea mare.")
            body.extend(chunk)
        try:
            change = QuoteAdminUpdate.model_validate_json(bytes(body))
        except ValidationError:
            raise _error(422, "Status, notă sau versiune invalidă. Nota poate avea cel mult 4000 de caractere.") from None
        return response((await repository.update(quote_id, change)).model_dump(mode="json"))

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
        digest = hmac.new(self.secret.encode(), ("quote-ip:" + client_ip).encode(), hashlib.sha256).hexdigest()
        query = {"_id": f"{digest}:{window}"}
        update = {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}}
        try:
            try:
                document = await self.collection.find_one_and_update(
                    query, update, upsert=True, return_document=ReturnDocument.AFTER,
                )
            except DuplicateKeyError:
                # Another function inserted this bucket between the match and upsert.
                document = await self.collection.find_one_and_update(
                    query, {"$inc": {"count": 1}}, return_document=ReturnDocument.AFTER,
                )
            if document is None:
                raise _error(503, UNAVAILABLE)
            if document["count"] > 5:
                raise _error(429, "Prea multe solicitări. Încearcă din nou mai târziu.", **{
                    "Retry-After": str(max(1, math.ceil(expires_at.timestamp() - now))),
                })
        except PyMongoError:
            raise _error(503, UNAVAILABLE) from None
