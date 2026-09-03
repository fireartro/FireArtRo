"""Mongo-backed Admin sessions. Mounting and index creation belong to server.py."""

import asyncio
import base64
import hashlib
import hmac
import ipaddress
import math
import os
import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError, PyMongoError

ADMIN_COOKIE_NAME = "fireartro_admin_session"
ADMIN_COOKIE_PATH = "/api/admin"
SESSION_LIFETIME = timedelta(hours=12)
LOGIN_WINDOW = timedelta(minutes=10)
LOGIN_ATTEMPT_LIMIT = 5
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
INVALID_CREDENTIALS = "Datele de autentificare nu sunt valide."
AUTH_UNAVAILABLE = "Autentificarea nu este disponibilă momentan."


def utc_now():
    return datetime.now(timezone.utc)


def _utc(value):
    # Motor's default codec returns naive UTC; TTL comparisons still use BSON dates.
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def hash_token(raw_token: str, session_secret: str) -> str:
    """Shared Python/Node contract: lowercase HMAC-SHA256(secret, UTF-8 token)."""
    return hmac.new(
        session_secret.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _encoded(value, maximum):
    if not isinstance(value, str) or not value or len(value) > maximum:
        return None
    try:
        encoded = value.encode("utf-8")
    except UnicodeError:
        return None
    return encoded if len(encoded) <= maximum and b"\0" not in encoded else None


class AuthError(HTTPException):
    """Safe to expose through FastAPI; never includes credentials or DB details."""

    def __init__(self, detail=INVALID_CREDENTIALS, status_code=401, headers=None):
        super().__init__(
            status_code, detail, {"Cache-Control": "no-store", **(headers or {})}
        )


@dataclass(frozen=True)
class IssuedSession:
    raw_token: str = field(repr=False)
    csrf_token: str = field(repr=False)
    expires_at: datetime


@dataclass(frozen=True)
class AdminIdentity:
    username: str
    expires_at: datetime
    token_hash: str = field(repr=False)
    csrf_hash: str = field(repr=False)
    csrf_token: str = field(repr=False)


class MongoSessionRepository:
    def __init__(self, collection):
        self.collection = collection

    async def create(self, token_hash, csrf_hash, expires_at, user_agent, created_at):
        await self.collection.insert_one(
            {
                "_id": token_hash,
                "token_hash": token_hash,
                "csrf_hash": csrf_hash,
                "created_at": created_at,
                "expires_at": expires_at,
                "revoked_at": None,
                "user_agent": user_agent,
            }
        )

    async def find_active(self, token_hash, now):
        return await self.collection.find_one(
            {
                "token_hash": token_hash,
                "expires_at": {"$gt": now},
                "revoked_at": None,
            }
        )

    async def revoke(self, token_hash, now):
        await self.collection.update_one(
            {"token_hash": token_hash, "revoked_at": None},
            {"$set": {"revoked_at": now}},
        )


class MongoLoginAttemptRepository:
    """Rolling reservations shared by every process, using atomic Mongo CAS.

    The unique Mongo _id is an IP HMAC. Pending verifications consume capacity;
    crashes/cancellations conservatively consume it until the ten-minute expiry.
    Random revisions prevent ABA if the TTL monitor removes/recreates a document.
    """

    def __init__(self, collection):
        self.collection = collection

    @staticmethod
    def _live_entries(document, now):
        return (
            [
                entry
                for entry in document["entries"]
                if _utc(entry["attempted_at"]) + LOGIN_WINDOW > now
            ]
            if document
            else []
        )

    async def _save(self, key, previous, entries, now):
        document = {
            "_id": key,
            "revision": secrets.token_hex(16),
            "entries": entries,
            "expires_at": max(
                (_utc(entry["attempted_at"]) + LOGIN_WINDOW for entry in entries),
                default=now,
            ),
        }
        if previous is None:
            try:
                await self.collection.insert_one(document)
                return True
            except DuplicateKeyError:
                return False  # another function reserved first; re-read its budget
        result = await self.collection.replace_one(
            {"_id": key, "revision": previous["revision"]}, document
        )
        return result.matched_count == 1

    async def reserve(self, key, now):
        reservation = secrets.token_hex(16)
        for _ in range(32):
            previous = await self.collection.find_one({"_id": key})
            entries = self._live_entries(previous, now)
            if len(entries) >= LOGIN_ATTEMPT_LIMIT:
                retry_after = max(
                    1,
                    math.ceil(
                        min(
                            (
                                _utc(entry["attempted_at"]) + LOGIN_WINDOW - now
                            ).total_seconds()
                            for entry in entries
                        )
                    ),
                )
                raise AuthError(
                    "Prea multe încercări. Încercați din nou mai târziu.",
                    429,
                    {"Retry-After": str(retry_after)},
                )
            entries.append({"id": reservation, "attempted_at": now, "state": "pending"})
            if await self._save(key, previous, entries, now):
                return reservation
        raise AuthError(AUTH_UNAVAILABLE, 503)

    async def _finish(self, key, reservation, now, success):
        for _ in range(32):
            previous = await self.collection.find_one({"_id": key})
            entries = self._live_entries(previous, now)
            if not any(entry["id"] == reservation for entry in entries):
                return
            if success:
                # Clear completed failures, but never erase another in-flight login.
                entries = [
                    entry
                    for entry in entries
                    if entry["id"] != reservation and entry["state"] == "pending"
                ]
            else:
                entries = [
                    (
                        {**entry, "state": "failed"}
                        if entry["id"] == reservation
                        else entry
                    )
                    for entry in entries
                ]
            if await self._save(key, previous, entries, now):
                return
        raise AuthError(AUTH_UNAVAILABLE, 503)

    async def record_failure(self, key, reservation, now):
        await self._finish(key, reservation, now, success=False)

    async def clear(self, key, reservation, now):
        await self._finish(key, reservation, now, success=True)


class AuthService:
    def __init__(
        self,
        sessions,
        attempts,
        username,
        password_hash,
        session_secret,
        *,
        clock=utc_now,
    ):
        self.sessions = sessions
        self.attempts = attempts
        self.username = username
        self.password_hash = password_hash
        self.session_secret = session_secret
        self.clock = clock
        errors = []
        if _encoded(username, 256) is None:
            errors.append("ADMIN_USERNAME")
        # Bound work and require canonical bcrypt base64 (including padding bits)
        # without running an expensive password check during app construction.
        if not isinstance(password_hash, str) or not re.fullmatch(
            r"\$2[aby]\$(?:0[4-9]|1[0-6])\$"
            r"[./A-Za-z0-9]{21}[.Oeu][./A-Za-z0-9]{30}[.CGKOSWaeimquy26]",
            password_hash,
        ):
            errors.append("ADMIN_PASSWORD_HASH")
        secret = _encoded(session_secret, 4096)
        if secret is None or len(secret) < 32 or not session_secret.strip():
            errors.append("ADMIN_SESSION_SECRET")
        self.configuration_errors = tuple(errors)

    def _ensure_configured(self):
        if self.configuration_errors:
            raise AuthError(AUTH_UNAVAILABLE, 503)

    def _csrf_token(self, raw_token):
        digest = hmac.new(
            self.session_secret.encode("utf-8"),
            b"fireartro:admin-csrf:v1\0" + raw_token.encode("ascii"),
            hashlib.sha256,
        ).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    def _ip_key(self, client_ip):
        try:
            canonical = str(ipaddress.ip_address(client_ip))
        except ValueError:
            canonical = "unknown"
        return hmac.new(
            self.session_secret.encode("utf-8"),
            b"fireartro:admin-login-ip:v1\0" + canonical.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()

    async def login(self, username, password, client_ip, user_agent):
        self._ensure_configured()
        key = self._ip_key(client_ip)
        try:
            reservation = await self.attempts.reserve(key, _utc(self.clock()))
            username_bytes, password_bytes = _encoded(username, 256), _encoded(
                password, 72
            )
            matches = False
            if username_bytes is not None and password_bytes is not None:
                try:
                    password_matches = await asyncio.to_thread(
                        bcrypt.checkpw,
                        password_bytes,
                        self.password_hash.encode("ascii"),
                    )
                except ValueError:
                    raise AuthError(AUTH_UNAVAILABLE, 503) from None
                matches = (
                    secrets.compare_digest(
                        username_bytes, self.username.encode("utf-8")
                    )
                    and password_matches
                )
            if not matches:
                await self.attempts.record_failure(key, reservation, _utc(self.clock()))
                raise AuthError()
            await self.attempts.clear(key, reservation, _utc(self.clock()))
            raw_token = secrets.token_urlsafe(48)
            csrf_token = self._csrf_token(raw_token)
            created_at = _utc(self.clock())
            expires_at = created_at + SESSION_LIFETIME
            agent = user_agent if isinstance(user_agent, str) else ""
            agent = agent.encode("utf-8", errors="replace")[:512].decode(
                "utf-8", errors="ignore"
            )
            await self.sessions.create(
                hash_token(raw_token, self.session_secret),
                hash_token(csrf_token, self.session_secret),
                expires_at,
                agent,
                created_at,
            )
            return IssuedSession(raw_token, csrf_token, expires_at)
        except PyMongoError:
            raise AuthError(AUTH_UNAVAILABLE, 503) from None

    async def authenticate(self, raw_token):
        self._ensure_configured()
        if not isinstance(raw_token, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{64}", raw_token
        ):
            raise AuthError()
        token_hash = hash_token(raw_token, self.session_secret)
        try:
            document = await self.sessions.find_active(token_hash, _utc(self.clock()))
        except PyMongoError:
            raise AuthError(AUTH_UNAVAILABLE, 503) from None
        if not document:
            raise AuthError()
        csrf_token = self._csrf_token(raw_token)
        stored_csrf = document.get("csrf_hash", "")
        if (
            not isinstance(stored_csrf, str)
            or not re.fullmatch(r"[a-f0-9]{64}", stored_csrf)
            or not secrets.compare_digest(
                stored_csrf, hash_token(csrf_token, self.session_secret)
            )
        ):
            raise AuthError()
        return AdminIdentity(
            self.username,
            _utc(document["expires_at"]),
            token_hash,
            stored_csrf,
            csrf_token,
        )

    def verify_csrf(self, identity, csrf_token):
        self._ensure_configured()
        if (
            not isinstance(csrf_token, str)
            or not re.fullmatch(r"[A-Za-z0-9_-]{43}", csrf_token)
            or not secrets.compare_digest(
                hash_token(csrf_token, self.session_secret), identity.csrf_hash
            )
        ):
            raise AuthError("Cererea nu este permisă.", 403)

    async def logout(self, raw_token):
        self._ensure_configured()
        if not isinstance(raw_token, str) or not re.fullmatch(
            r"[A-Za-z0-9_-]{64}", raw_token
        ):
            return
        try:
            await self.sessions.revoke(
                hash_token(raw_token, self.session_secret), _utc(self.clock())
            )
        except PyMongoError:
            raise AuthError(AUTH_UNAVAILABLE, 503) from None


def _origin_tuple(value):
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
        or "?" in value
        or "#" in value
        or parsed.netloc.endswith(":")
        or any(
            character.isspace() or ord(character) < 32 or ord(character) == 127
            for character in value
        )
    ):
        raise ValueError("Invalid origin")
    port = parsed.port
    return (
        parsed.scheme,
        parsed.hostname.lower(),
        port if port is not None else (443 if parsed.scheme == "https" else 80),
    )


def _request_origin(request):
    # Vercel supplies the public Host and forwarded protocol. Never use a CORS
    # allowlist or arbitrary Forwarded/X-Forwarded-Host as authentication proof.
    scheme = request.url.scheme
    if os.environ.get("VERCEL") == "1":
        protocols = request.headers.getlist("x-forwarded-proto")
        if protocols:
            if len(protocols) != 1 or protocols[0] not in {"http", "https"}:
                raise ValueError("Invalid platform protocol")
            scheme = protocols[0]
    if len(request.headers.getlist("host")) != 1:
        raise ValueError("Missing or ambiguous host")
    return _origin_tuple(f"{scheme}://{request.headers['host']}")


def request_ip(request):
    # https://vercel.com/docs/headers/request-headers documents XFF overwrite.
    # Only the server-side VERCEL=1 flag activates that trust boundary.
    if os.environ.get("VERCEL") == "1":
        addresses = request.headers.getlist("x-forwarded-for")
        if len(addresses) == 1:
            try:
                return str(ipaddress.ip_address(addresses[0]))
            except ValueError:
                pass
    return request.client.host if request.client else "unknown"


def verify_same_origin(request):
    origins = request.headers.getlist("origin")
    try:
        if len(origins) > 1 or (
            origins and _origin_tuple(origins[0]) != _request_origin(request)
        ):
            raise ValueError("Different origin")
        if request.headers.get("sec-fetch-site") in {"cross-site", "same-site"}:
            raise ValueError("Different site")
    except (ValueError, UnicodeError):
        raise AuthError("Cererea nu este permisă.", 403) from None


async def require_admin_session(
    request: Request, x_csrf_token: str | None = Header(default=None)
) -> AdminIdentity:
    service = getattr(request.app.state, "auth_service", None)
    if service is None:
        raise AuthError(AUTH_UNAVAILABLE, 503)
    identity = await service.authenticate(request.cookies.get(ADMIN_COOKIE_NAME, ""))
    if request.method not in SAFE_METHODS:
        verify_same_origin(request)
        service.verify_csrf(identity, x_csrf_token)
    return identity


def _session_response(username, csrf_token, expires_at):
    return JSONResponse(
        {
            "admin": {"username": username},
            "csrf_token": csrf_token,
            "expires_at": expires_at.isoformat(),
        },
        headers={"Cache-Control": "no-store"},
    )


def create_auth_router(service):
    """Factory only: Task 3 sets app.state.auth_service and includes this router."""
    router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

    @router.post("/login")
    async def login(request: Request):
        verify_same_origin(request)
        payload = {}
        if (
            request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            == "application/json"
        ):
            try:
                if len(await request.body()) <= 4096:
                    payload = await request.json()
            except (ValueError, UnicodeError):
                pass
        if not isinstance(payload, dict):
            payload = {}
        issued = await service.login(
            payload.get("username"),
            payload.get("password"),
            request_ip(request),
            request.headers.get("user-agent", ""),
        )
        response = _session_response(
            service.username, issued.csrf_token, issued.expires_at
        )
        response.set_cookie(
            ADMIN_COOKIE_NAME,
            issued.raw_token,
            max_age=int(SESSION_LIFETIME.total_seconds()),
            expires=issued.expires_at,
            path=ADMIN_COOKIE_PATH,
            secure=True,
            httponly=True,
            samesite="strict",
        )
        return response

    @router.get("/session")
    async def session(identity: AdminIdentity = Depends(require_admin_session)):
        return _session_response(
            identity.username, identity.csrf_token, identity.expires_at
        )

    @router.post("/logout")
    async def logout(
        request: Request, identity: AdminIdentity = Depends(require_admin_session)
    ):
        await service.logout(request.cookies.get(ADMIN_COOKIE_NAME, ""))
        response = JSONResponse({"ok": True}, headers={"Cache-Control": "no-store"})
        response.delete_cookie(
            ADMIN_COOKIE_NAME,
            path=ADMIN_COOKIE_PATH,
            secure=True,
            httponly=True,
            samesite="strict",
        )
        return response

    return router
