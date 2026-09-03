"""Admin Blob metadata and reference-safe deletion. Mounting belongs to server.py.

Install MediaWriteGuardMiddleware on the app alongside create_media_router().
All non-HTTP CMS/Blog writes must also use service.reference_write_guard(payload).
The Mongo mutex intentionally has NO TTL: process death leaves a recoverable,
fail-closed lock rather than allowing a slow writer to race a physical deletion.
Do not automatically unlock it; drain writers and reconcile deleting records first.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.responses import JSONResponse

from auth import require_admin_session


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 500 * 1024 * 1024
MEDIA_ID_PATTERN = r"media-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
MEDIA_PATH = re.compile(rf"cms/{MEDIA_ID_PATTERN}/asset\.(?:jpg|png|webp|avif|mp4|webm)")
ORIGIN_PATTERN = r"https://[a-z0-9]+\.public\.blob\.vercel-storage\.com"
REFERENCE_COLLECTIONS = (
    "site_content_drafts", "site_content_publications", "site_content_revisions", "blog_posts",
)
SAFE_FIELDS = (
    "id", "pathname", "url", "content_type", "size", "declared_size", "filename", "alt_text",
    "width", "height", "dimensions_source", "created_at", "created_by", "state",
)


class MediaError(HTTPException):
    def __init__(self, status_code=503, detail="Biblioteca media nu este disponibilă momentan."):
        super().__init__(status_code, detail, headers={"Cache-Control": "no-store"})


class MediaInUse(MediaError):
    def __init__(self):
        super().__init__(409, "Fișierul este folosit în conținut, Blog sau în istoricul publicărilor.")


def _configured_origin(origin):
    if not isinstance(origin, str) or not re.fullmatch(ORIGIN_PATTERN, origin):
        raise MediaError(503, "Stocarea media nu este configurată.")
    return origin


def validate_blob(item, origin):
    _configured_origin(origin)
    mime, size, path = item.get("content_type"), item.get("size"), item.get("pathname", "")
    maximum = MAX_IMAGE_BYTES if mime in ALLOWED_IMAGE_TYPES else MAX_VIDEO_BYTES
    extensions = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                  "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm"}
    if (mime not in extensions or type(size) is not int or not 0 < size <= maximum
            or not MEDIA_PATH.fullmatch(path) or not path.endswith("." + extensions[mime])
            or item.get("url") != f"{origin}/{path}"):
        raise MediaError(400, "Fișierul sau metadatele nu sunt valide.")


def validate_pending_blob(item, origin):
    """Validate a callback-pending record without treating its object as public.

    A client may have uploaded the bytes while the verified callback was lost.
    The draft must still not receive a URL until the Node endpoint re-checks Blob
    with HEAD, but delete/recovery operations need the same strict pathname and
    declared byte constraints as a completed object.
    """
    path = item.get("pathname", "")
    validate_blob({**item, "size": item.get("declared_size"), "url": f"{origin}/{path}"}, origin)


def _strings(value, path=""):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from _strings(child, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _strings(child, f"{path}[{index}]")
    elif isinstance(value, str):
        yield path, unquote(value)


def find_references(item, documents):
    """Scan authoritative documents, including every revision and Blog status.

    URL references, legacy content fields, nested arrays and embedded plain-text
    URLs count too. Conservative substring matching may over-protect an asset.
    Cached counters on cms_media are never deletion authority.
    """
    needles = [item[key] for key in ("id", "url", "pathname") if item.get(key)]
    references = []
    for collection, document in documents:
        paths = [path for path, value in _strings(document) if any(needle in value for needle in needles)]
        if paths:
            references.append({"collection": collection, "document_id": str(document.get("id", document.get("_id", ""))),
                               "paths": paths})
    return references


class MongoMediaRepository:
    def __init__(self, db):
        self.db = db

    def _ready(self):
        if self.db is None:
            raise MediaError()

    async def create_indexes(self):
        self._ready()
        await self.db.cms_media.create_index("id", unique=True)
        await self.db.cms_media.create_index("pathname", unique=True)
        await self.db.cms_media.create_index([("state", 1), ("created_at", -1)])
        # cms_media_write_locks uses Mongo's built-in unique _id. Never add TTL.

    async def get(self, media_id):
        self._ready()
        return await self.db.cms_media.find_one({"id": media_id}, {"_id": 0})

    async def resolve(self, value):
        self._ready()
        return await self.db.cms_media.find_one({"$or": [
            {"id": value}, {"url": value}, {"pathname": value},
        ]}, {"_id": 0})

    async def list(self, limit, offset):
        self._ready()
        return await self.db.cms_media.find({"state": {"$in": ["ready", "pending", "deleting"]}}, {"_id": 0})\
            .sort([("created_at", -1), ("id", 1)]).skip(offset).limit(limit).to_list(length=limit)

    async def references_many(self, items):
        self._ready()
        result = {item["id"]: [] for item in items}
        for collection in REFERENCE_COLLECTIONS:
            async for document in self.db[collection].find({}):
                for item in items:
                    result[item["id"]].extend(find_references(item, [(collection, document)]))
        return result

    async def references(self, item):
        return (await self.references_many([item]))[item["id"]]

    async def update_alt(self, media_id, value):
        self._ready()
        await self.db.cms_media.update_one({"id": media_id, "state": "ready"}, {"$set": {"alt_text": value}})

    async def set_state(self, media_id, state):
        self._ready()
        await self.db.cms_media.update_one({"id": media_id}, {"$set": {
            "state": state, "updated_at": datetime.now(timezone.utc),
        }})

    @asynccontextmanager
    async def write_guard(self):
        self._ready()
        owner = str(uuid.uuid4())
        try:
            await self.db.cms_media_write_locks.insert_one({
                "_id": "content-and-media", "owner": owner,
                "created_at": datetime.now(timezone.utc),
            })
        except DuplicateKeyError:
            raise MediaError(409, "O operație de conținut este în curs. Reîncearcă salvarea.") from None
        try:
            yield
        finally:
            await asyncio.shield(self.db.cms_media_write_locks.delete_one({"_id": "content-and-media", "owner": owner}))


class VercelBlobClient:
    def __init__(self, token=None):
        self._token = token if token is not None else os.environ.get("BLOB_READ_WRITE_TOKEN", "")

    def ensure_configured(self):
        if not self._token.strip():
            raise MediaError(503, "Stocarea media nu este configurată.")

    async def delete(self, url):
        self.ensure_configured()
        # Official vercel==0.10.0: delete() is synchronous, delete_async() is async.
        from vercel.blob import delete_async
        await delete_async(url, token=self._token)


class MediaService:
    def __init__(self, repository, blob_client, *, origin=None):
        self.repository = repository
        self.blob_client = blob_client
        self.origin = origin if origin is not None else os.environ.get("VERCEL_BLOB_MEDIA_ORIGIN", "")

    def _ready(self):
        _configured_origin(self.origin)
        self.blob_client.ensure_configured()

    @staticmethod
    def _response(item, references):
        return {**{key: item.get(key) for key in SAFE_FIELDS},
                "references": references, "usage_count": len(references)}

    async def get(self, media_id):
        self._ready()
        item = await self.repository.get(media_id)
        if not item or item.get("state") == "deleted":
            raise MediaError(404, "Fișierul media nu există.")
        if item.get("state") == "pending" or (item.get("state") == "deleting" and not item.get("url")):
            raise MediaError(404, "Încărcarea așteaptă confirmarea stocării.")
        validate_blob(item, self.origin)
        return self._response(item, await self.repository.references(item))

    async def list(self, limit=25, offset=0):
        self._ready()
        items = await self.repository.list(limit, offset)
        references = await self.repository.references_many(items)
        for item in items:
            if item.get("state") == "pending" or (item.get("state") == "deleting" and not item.get("url")):
                validate_pending_blob(item, self.origin)
            else:
                validate_blob(item, self.origin)
        return [self._response(item, references[item["id"]]) for item in items]

    @asynccontextmanager
    async def reference_write_guard(self, content=None):
        # CMS writes using checked-in assets still work before Blob is provisioned.
        async with self.repository.write_guard():
            for _, value in _strings(content):
                candidates = set(re.findall(MEDIA_ID_PATTERN, value))
                candidates.update(re.findall(ORIGIN_PATTERN + r"/[^\s\"'<>]+", value))
                for candidate in candidates:
                    if candidate.startswith("https:"):
                        parts = urlsplit(candidate)
                        candidate = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
                    item = await self.repository.resolve(candidate)
                    if not item or item.get("state") != "ready":
                        raise MediaError(409, "Conținutul folosește un fișier media indisponibil. Reîncarcă biblioteca.")
            yield

    async def update_alt(self, media_id, value):
        self._ready()
        async with self.reference_write_guard():
            await self.get(media_id)
            await self.repository.update_alt(media_id, value)
            return await self.get(media_id)

    async def delete(self, media_id, *, confirm_id):
        self._ready()
        if confirm_id != media_id:
            raise MediaError(400, "Confirmă identificatorul fișierului de șters.")
        async with self.reference_write_guard():
            item = await self.repository.get(media_id)
            if not item:
                raise MediaError(404, "Fișierul media nu există.")
            if item.get("state") == "deleted":
                return
            if item.get("state") == "pending" or (item.get("state") == "deleting" and not item.get("url")):
                validate_pending_blob(item, self.origin)
                delete_url = f"{self.origin}/{item['pathname']}"
            else:
                validate_blob(item, self.origin)
                delete_url = item["url"]
            if await self.repository.references(item):
                raise MediaInUse()
            # Persist before network IO. Unknown provider outcomes remain unavailable.
            await self.repository.set_state(media_id, "deleting")
            try:
                await self.blob_client.delete(delete_url)
            except Exception:
                raise MediaError() from None
            await self.repository.set_state(media_id, "deleted")


class MediaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alt_text: str = Field(max_length=240)

    @field_validator("alt_text")
    @classmethod
    def normalize_alt(cls, value):
        if any(ord(char) < 32 and char not in "\n\r\t" for char in value):
            raise ValueError("Textul alternativ nu este valid.")
        return " ".join(value.split())


class DeleteConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_id: str = Field(pattern=f"^{MEDIA_ID_PATTERN}$")


def create_media_router(service):
    router = APIRouter(prefix="/api/admin/media", tags=["admin-media"], dependencies=[Depends(require_admin_session)])

    async def safe(operation):
        try:
            return await operation
        except (PyMongoError, TimeoutError):
            raise MediaError() from None

    @router.get("")
    async def list_media(response: Response, limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
        response.headers["Cache-Control"] = "no-store"
        return await safe(service.list(limit, offset))

    @router.get("/{media_id}")
    async def get_media(media_id: str, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return await safe(service.get(media_id))

    @router.patch("/{media_id}")
    async def patch_media(media_id: str, patch: MediaPatch, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return await safe(service.update_alt(media_id, patch.alt_text))

    @router.delete("/{media_id}", status_code=204)
    async def delete_media(media_id: str, confirmation: DeleteConfirmation):
        await safe(service.delete(media_id, confirm_id=confirmation.confirm_id))
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    return router


class MediaWriteGuardMiddleware:
    """Serialize all HTTP CMS/Blog writes with physical media deletion.

    Uses pure ASGI so the lock covers the complete request, not a background task.
    Authentication precedes buffering/locking. Upload callbacks do not need this
    lock: they only transition pending -> ready, never replace/delete references.
    """
    def __init__(self, app, service):
        self.app, self.service = app, service

    async def __call__(self, scope, receive, send):
        path, method = scope.get("path", ""), scope.get("method", "GET")
        protected = (path.startswith("/api/admin/content/")
                     or path == "/api/admin/blog/posts" or path.startswith("/api/admin/blog/posts/"))
        if scope["type"] != "http" or not protected or method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await self.app(scope, receive, send)
        try:
            request = Request(scope)
            await require_admin_session(request, request.headers.get("x-csrf-token"))
            maximum = 128 * 1024 if path.startswith("/api/admin/blog/") else 1024 * 1024
            chunks, length = [], 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                length += len(chunk)
                if length > maximum:
                    raise MediaError(413, "Conținutul depășește limita permisă.")
                chunks.append(chunk)
                if not message.get("more_body", False):
                    break
            body = b"".join(chunks)
            try:
                payload = json.loads(body) if body else None
            except (ValueError, UnicodeError):
                raise MediaError(400, "Conținutul nu este valid.") from None
            replayed = False

            async def replay():
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            async with self.service.reference_write_guard(payload):
                await self.app(scope, replay, send)
        except (HTTPException, PyMongoError, TimeoutError) as error:
            if not isinstance(error, HTTPException):
                error = MediaError()
            await JSONResponse({"detail": error.detail}, status_code=error.status_code,
                               headers={"Cache-Control": "no-store"})(scope, receive, send)
