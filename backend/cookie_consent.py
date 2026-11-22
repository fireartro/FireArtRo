"""Versioned evidence for optional cookie and external-content choices."""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from hmac import compare_digest
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, UUID4, ValidationError, model_validator
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import require_admin_session, request_ip, verify_same_origin


CONSENT_WRITE_MAX_BYTES = 512
CONSENT_WRITE_PATHS = {"/api/consent", "/api/consent/withdraw"}
EVIDENCE_RETENTION = timedelta(days=365)
WITHDRAWAL_RETRY_WINDOW = timedelta(hours=24)
NO_STORE = {"Cache-Control": "no-store"}


def _error(status, detail):
    return HTTPException(status, detail, headers=NO_STORE)


def _unavailable():
    return _error(503, "Registrul de consimțământ nu este disponibil momentan.")


def _conflict():
    return _error(409, "Această referință nu poate fi folosită pentru acord.")


def _not_found():
    return _error(404, "Dovada consimțământului nu a fost găsită.")


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _timestamp(value):
    return _utc(value).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ConsentReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID4
    withdrawKey: UUID4


class ConsentGrant(ConsentReference):
    version: int = Field(strict=True, ge=3, le=3)
    analytics: StrictBool
    marketing: StrictBool
    retentionDays: int = Field(strict=True, ge=1, le=730)
    contentRevision: str | None = Field(
        default=None, strict=True, max_length=80, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$"
    )
    method: Literal["accept_all", "preferences"]

    @model_validator(mode="after")
    def coherent_choices(self):
        if not (self.analytics or self.marketing):
            raise ValueError("No optional category")
        if self.method == "accept_all" and not (self.analytics and self.marketing):
            raise ValueError("Accept all must enable both categories")
        return self


class MongoConsentLedger:
    def __init__(self, collection, *, clock=lambda: datetime.now(timezone.utc)):
        self.collection = collection
        self.clock = clock

    async def create_indexes(self):
        if self.collection is None:
            raise PyMongoError("Consent evidence storage unavailable")
        await self.collection.create_index("delete_after", expireAfterSeconds=0)

    def _time(self):
        now = _utc(self.clock())
        # Mongo stores millisecond precision. Initial responses and retries match.
        return now.replace(microsecond=(now.microsecond // 1000) * 1000)

    @staticmethod
    def _receipt(document):
        return {
            "id": document["_id"],
            "version": document["version"],
            "analytics": document["analytics"],
            "marketing": document["marketing"],
            "contentRevision": document["content_revision"],
            "method": document["method"],
            "savedAt": _timestamp(document["saved_at"]),
            "expiresAt": _timestamp(document["expires_at"]),
        }

    async def grant(self, grant):
        now = self._time()
        expires = now + timedelta(days=grant.retentionDays)
        key = {"_id": str(grant.id)}
        details = {
            "version": grant.version,
            "analytics": grant.analytics,
            "marketing": grant.marketing,
            "retention_days": grant.retentionDays,
            "content_revision": grant.contentRevision,
            "method": grant.method,
            "withdraw_key_hash": sha256(grant.withdrawKey.bytes).hexdigest(),
        }
        if self.collection is None:
            raise _unavailable()
        try:
            document = {
                **key, **details, "saved_at": now, "expires_at": expires,
                "withdrawn_at": None, "delete_after": expires + EVIDENCE_RETENTION,
            }
            try:
                await self.collection.insert_one(document)
                return self._receipt(document)
            except DuplicateKeyError:
                previous = await self.collection.find_one(key)
            if (
                previous is None
                or previous.get("withdrawn_at") is not None
                or any(previous.get(field) != value for field, value in details.items())
                or _utc(previous["expires_at"]) <= now
            ):
                raise _conflict()
            return self._receipt(previous)
        except PyMongoError:
            raise _unavailable() from None

    async def withdraw(self, reference):
        now = self._time()
        key = {"_id": str(reference.id)}
        withdraw_hash = sha256(reference.withdrawKey.bytes).hexdigest()
        if self.collection is None:
            raise _unavailable()
        try:
            current = await self.collection.find_one(key)
            if current is None:
                try:
                    # Withdrawal may reach the server while this grant is still in flight.
                    await self.collection.insert_one({
                        **key, "withdrawn_at": now,
                        "withdraw_key_hash": withdraw_hash,
                        "delete_after": now + WITHDRAWAL_RETRY_WINDOW,
                    })
                    return
                except DuplicateKeyError:
                    current = await self.collection.find_one(key)
            if current is None:
                return
            if not compare_digest(current.get("withdraw_key_hash", ""), withdraw_hash):
                raise _conflict()
            if current["withdrawn_at"] is None:
                await self.collection.update_one(
                    {**key, "withdraw_key_hash": withdraw_hash, "withdrawn_at": None},
                    {"$set": {
                        "withdrawn_at": now,
                        "delete_after": min(now, _utc(current["expires_at"])) + EVIDENCE_RETENTION,
                    }},
                )
        except PyMongoError:
            raise _unavailable() from None

    async def lookup(self, receipt_id):
        if self.collection is None:
            raise _unavailable()
        try:
            document = await self.collection.find_one({"_id": str(receipt_id)})
        except PyMongoError:
            raise _unavailable() from None
        now = self._time()
        if document is None or "saved_at" not in document or _utc(document["delete_after"]) <= now:
            raise _not_found()
        withdrawn = document["withdrawn_at"]
        status = "active"
        if withdrawn is not None:
            status = "withdrawn"
        elif _utc(document["expires_at"]) <= now:
            status = "expired"
        return {
            **self._receipt(document),
            "withdrawnAt": _timestamp(withdrawn) if withdrawn is not None else None,
            "deleteAfter": _timestamp(document["delete_after"]),
            "status": status,
        }


async def _request_body(request: Request, model):
    if not request.headers.get("origin"):
        raise _error(403, "Cererea nu este permisă.")
    verify_same_origin(request)
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise _error(415, "Cererea necesită formatul JSON.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > CONSENT_WRITE_MAX_BYTES:
            raise _error(413, "Cererea este prea mare.")
        data.extend(chunk)
    try:
        return model.model_validate_json(data)
    except ValidationError:
        raise _error(422, "Alegerea pentru consimțământ este invalidă.") from None


def create_consent_router(ledger, grant_limiter, withdrawal_limiter, *, ready=lambda: True):
    router = APIRouter(tags=["consent"])

    @router.post("/api/consent")
    async def consent(request: Request, response: Response):
        choice = await _request_body(request, ConsentGrant)
        if not ready():
            raise _unavailable()
        await grant_limiter.enforce(request_ip(request))
        response.headers.update(NO_STORE)
        return await ledger.grant(choice)

    @router.post("/api/consent/withdraw", status_code=204)
    async def withdraw(request: Request):
        choice = await _request_body(request, ConsentReference)
        if not ready():
            raise _unavailable()
        await withdrawal_limiter.enforce(request_ip(request))
        await ledger.withdraw(choice)
        return Response(status_code=204, headers=NO_STORE)

    @router.get("/api/admin/consent/{receipt_id}", dependencies=[Depends(require_admin_session)])
    async def consent_record(receipt_id: UUID4, response: Response):
        response.headers.update(NO_STORE)
        return await ledger.lookup(receipt_id)

    return router
