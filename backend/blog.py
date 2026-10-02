"""Public and administrative Blog domain for FireArtRo."""

import hashlib
import json
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional, Protocol

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response
from gridfs.errors import NoFile
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from auth import require_admin_session


ALLOWED_BLOG_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_BLOG_MEDIA_BYTES = 6 * 1024 * 1024


def slugify_ro(value):
    """Create a stable URL segment while preserving Romanian word meaning."""
    translated = str(value or "").translate(
        str.maketrans(
            {
                "ă": "a",
                "â": "a",
                "î": "i",
                "ș": "s",
                "ş": "s",
                "ț": "t",
                "ţ": "t",
                "Ă": "A",
                "Â": "A",
                "Î": "I",
                "Ș": "S",
                "Ş": "S",
                "Ț": "T",
                "Ţ": "T",
            }
        )
    )
    ascii_value = (
        unicodedata.normalize("NFKD", translated)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "articol"


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def request_size_limit(path, method):
    if path == "/api/webhooks/resend" and method.upper() == "POST":
        return 64 * 1024
    if (
        path.startswith("/api/admin/inbox/")
        and path.endswith("/reply")
        and method.upper() == "POST"
    ):
        return 128 * 1024
    if path == "/api/admin/blog/media":
        return 6 * 1024 * 1024
    if path.startswith("/api/admin/blog/posts") and method.upper() in {"POST", "PUT"}:
        return 128 * 1024
    return 32_768


def image_signature_matches(content_type, data):
    signatures = {
        "image/jpeg": data.startswith(b"\xff\xd8\xff"),
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
        "image/avif": len(data) >= 12 and data[4:12] in {b"ftypavif", b"ftypavis"},
    }
    return signatures.get(content_type, False)


class BlogArticleBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    excerpt: str = Field(default="", max_length=320)
    body: str = Field(min_length=1, max_length=50_000)
    category: str = Field(default="", max_length=80)
    cover_media_id: str = ""
    cover_alt: str = Field(default="", max_length=240)

    @field_validator("cover_media_id")
    @classmethod
    def validate_cover_media_id(cls, value):
        normalized = str(value or "").strip().lower()
        if normalized and not re.fullmatch(r"[0-9a-f]{24}", normalized):
            raise ValueError("Identificatorul imaginii nu este valid.")
        return normalized

    @model_validator(mode="after")
    def normalize_and_validate(self):
        self.title = " ".join(self.title.strip().split())
        self.excerpt = " ".join(self.excerpt.strip().split())
        self.category = " ".join(self.category.strip().split())
        self.body = self.body.strip()
        self.cover_alt = " ".join(self.cover_alt.strip().split())
        if not self.title or not self.body:
            raise ValueError("Titlul și conținutul sunt obligatorii.")
        if self.cover_media_id and not self.cover_alt:
            raise ValueError("Textul alternativ este obligatoriu pentru imagine.")
        return self


class BlogArticleCreate(BlogArticleBase):
    pass


class BlogArticleUpdate(BlogArticleBase):
    status: Literal["draft", "published"]
    version: int = Field(strict=True, ge=1, le=2**53 - 2)


class BlogArticleResponse(BlogArticleBase):
    model_config = ConfigDict(extra="ignore")

    id: str
    slug: str
    status: Literal["draft", "published"]
    created_at: str
    updated_at: str
    published_at: Optional[str] = None
    version: int = 1  # Documents predating optimistic concurrency start at version 1.


class BlogSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    slug: str
    title: str
    excerpt: str = ""
    category: str = ""
    cover_media_id: str = ""
    cover_alt: str = ""
    published_at: str
    updated_at: str


class BlogRepository(Protocol):
    async def list_published(self, limit=None):
        raise NotImplementedError

    async def get_published_by_slug(self, slug):
        raise NotImplementedError

    async def list_sitemap_entries(self, limit=1000):
        raise NotImplementedError

    async def list_all(self):
        raise NotImplementedError

    async def get_by_id(self, article_id):
        raise NotImplementedError

    async def slug_exists(self, slug):
        raise NotImplementedError

    async def insert(self, document):
        raise NotImplementedError

    async def replace(self, article_id, document, expected_version):
        raise NotImplementedError

    async def delete(self, article_id, expected_version):
        raise NotImplementedError

    async def cover_is_referenced(self, media_id):
        raise NotImplementedError

    async def public_revision_entries(self):
        raise NotImplementedError


class MongoBlogRepository:
    def __init__(self, collection):
        self.collection = collection

    async def list_published(self, limit=None):
        cursor = self.collection.find(
            {"status": "published"},
            {"_id": 0, "body": 0, "status": 0, "created_at": 0},
        ).sort("published_at", -1)
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=limit or 10_000)

    async def get_published_by_slug(self, slug):
        return await self.collection.find_one(
            {"slug": slug, "status": "published"},
            {"_id": 0},
        )

    async def list_sitemap_entries(self, limit=1000):
        safe_limit = min(max(int(limit), 1), 1000)
        cursor = self.collection.find(
            {"status": "published"},
            {"_id": 0, "slug": 1, "updated_at": 1},
        ).sort([("published_at", -1), ("slug", 1)]).limit(safe_limit)
        return await cursor.to_list(length=safe_limit)

    async def list_all(self):
        cursor = self.collection.find({}, {"_id": 0}).sort("updated_at", -1)
        return await cursor.to_list(length=10_000)

    async def get_by_id(self, article_id):
        return await self.collection.find_one({"id": article_id}, {"_id": 0})

    async def slug_exists(self, slug):
        return await self.collection.count_documents({"slug": slug}, limit=1) > 0

    async def insert(self, document):
        await self.collection.insert_one(dict(document))
        return document

    @staticmethod
    def _version_query(article_id, expected_version):
        query = {"id": article_id}
        if expected_version == 1:
            query["$or"] = [{"version": 1}, {"version": {"$exists": False}}]
        else:
            query["version"] = expected_version
        return query

    async def replace(self, article_id, document, expected_version):
        result = await self.collection.replace_one(
            self._version_query(article_id, expected_version), dict(document)
        )
        return document if result.matched_count else None

    async def delete(self, article_id, expected_version):
        return await self.collection.find_one_and_delete(
            self._version_query(article_id, expected_version), projection={"_id": 0}
        )

    async def cover_is_referenced(self, media_id):
        return await self.collection.count_documents({"cover_media_id": media_id}, limit=1) > 0

    async def public_revision_entries(self):
        # No drafts or article text enter the anonymous revision contract.
        cursor = self.collection.find(
            {"status": "published"}, {"_id": 0, "id": 1, "version": 1, "updated_at": 1}
        )
        return await cursor.to_list(length=None)


class GridFsBlogMediaStore:
    def __init__(self, bucket):
        self.bucket = bucket

    async def save(self, filename, content_type, data):
        media_id = await self.bucket.upload_from_stream(
            filename,
            data,
            metadata={"content_type": content_type},
        )
        return str(media_id)

    async def open(self, media_id):
        try:
            stream = await self.bucket.open_download_stream(ObjectId(media_id))
        except (InvalidId, NoFile):
            return None
        return {
            "filename": stream.filename,
            "content_type": (stream.metadata or {}).get(
                "content_type",
                "application/octet-stream",
            ),
            "data": await stream.read(),
        }

    async def delete(self, media_id):
        try:
            await self.bucket.delete(ObjectId(media_id))
        except (InvalidId, NoFile):
            return


class BlogService:
    def __init__(self, repository, media_store):
        self.repository = repository
        self.media_store = media_store

    async def list_public(self, limit=None):
        return await self.repository.list_published(limit)

    async def get_public(self, slug):
        item = await self.repository.get_published_by_slug(slug)
        if not item:
            raise HTTPException(status_code=404, detail="Articolul nu a fost găsit.")
        return item

    async def list_sitemap_entries(self, limit=1000):
        safe_limit = min(max(int(limit), 1), 1000)
        return await self.repository.list_sitemap_entries(safe_limit)

    async def public_revision(self):
        entries = await self.repository.public_revision_entries()
        public_state = sorted(
            (item["id"], item.get("version", 1), item["updated_at"]) for item in entries
        )
        return hashlib.sha256(json.dumps(public_state, separators=(",", ":")).encode()).hexdigest()

    async def _validate_cover(self, media_id):
        if not media_id:
            return
        media = await self.media_store.open(media_id)
        if not media:
            raise HTTPException(status_code=422, detail="Imaginea de copertă nu mai este disponibilă.")
        content_type = media.get("content_type")
        if content_type not in ALLOWED_BLOG_IMAGE_TYPES or not image_signature_matches(content_type, media["data"]):
            raise HTTPException(status_code=415, detail="Coperta trebuie să fie o imagine JPG, PNG, WebP sau AVIF validă.")

    async def _delete_unreferenced_cover(self, media_id):
        # Production HTTP writes already hold MediaWriteGuardMiddleware's shared
        # Mongo lock across validation, CAS, reference lookup and GridFS deletion.
        # Non-HTTP writers must use the same reference_write_guard.
        if media_id and not await self.repository.cover_is_referenced(media_id):
            await self.media_store.delete(media_id)

    @staticmethod
    def _conflict():
        return HTTPException(status_code=409, detail="Articolul a fost modificat în altă sesiune. Draftul local a fost păstrat; reîncarcă articolul înainte de a continua.")

    async def _unique_slug(self, title):
        base = slugify_ro(title)
        candidate = base
        suffix = 2
        while await self.repository.slug_exists(candidate):
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    async def list_admin(self):
        return await self.repository.list_all()

    async def create_article(self, payload):
        await self._validate_cover(payload.cover_media_id)
        now = utc_now()
        document = {
            **payload.model_dump(),
            "id": str(uuid.uuid4()),
            "slug": await self._unique_slug(payload.title),
            "status": "draft",
            "created_at": now,
            "updated_at": now,
            "published_at": None,
            "version": 1,
        }
        return await self.repository.insert(document)

    async def update_article(self, article_id, payload):
        current = await self.repository.get_by_id(article_id)
        if not current:
            raise HTTPException(status_code=404, detail="Articolul nu a fost găsit.")
        if current.get("version", 1) != payload.version:
            raise self._conflict()
        await self._validate_cover(payload.cover_media_id)

        published_at = current.get("published_at")
        if payload.status == "published" and not published_at:
            published_at = utc_now()
        updated = {
            **payload.model_dump(),
            "id": current["id"],
            "slug": current["slug"],
            "created_at": current["created_at"],
            "updated_at": utc_now(),
            "published_at": published_at,
            "version": payload.version + 1,
        }
        saved = await self.repository.replace(article_id, updated, payload.version)
        if not saved:
            raise self._conflict()

        old_cover = current.get("cover_media_id")
        if saved and old_cover and old_cover != updated.get("cover_media_id"):
            await self._delete_unreferenced_cover(old_cover)
        return saved

    async def delete_article(self, article_id, expected_version):
        current = await self.repository.get_by_id(article_id)
        if not current:
            raise HTTPException(status_code=404, detail="Articolul nu a fost găsit.")
        if current.get("version", 1) != expected_version:
            raise self._conflict()
        deleted = await self.repository.delete(article_id, expected_version)
        if not deleted:
            raise self._conflict()
        if deleted.get("cover_media_id"):
            await self._delete_unreferenced_cover(deleted["cover_media_id"])


def create_blog_router(service, admin_dependency=require_admin_session):
    router = APIRouter(prefix="/api")

    @router.get("/blog/revision")
    async def get_public_revision(response: Response, if_none_match: Optional[str] = Header(default=None)):
        revision = await service.public_revision()
        headers = {"ETag": f'"{revision}"', "Cache-Control": "no-store"}
        if if_none_match == headers["ETag"]:
            return Response(status_code=304, headers=headers)
        response.headers.update(headers)
        return {"revision_id": revision}

    @router.get("/blog/posts", response_model=list[BlogSummaryResponse])
    async def list_public_posts(
        limit: Optional[int] = Query(default=None, ge=1, le=100)
    ):
        return await service.list_public(limit)

    @router.get("/blog/posts/{slug}", response_model=BlogArticleResponse)
    async def get_public_post(slug: str):
        return await service.get_public(slugify_ro(slug))

    @router.get("/blog/media/{media_id}")
    async def read_blog_media(media_id: str):
        media = await service.media_store.open(media_id)
        if not media:
            raise HTTPException(status_code=404, detail="Imaginea nu a fost găsită.")
        return Response(
            content=media["data"],
            media_type=media["content_type"],
            headers={
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
        )

    @router.get("/admin/blog/posts", response_model=list[BlogArticleResponse])
    async def list_admin_posts(_=Depends(admin_dependency)):
        return await service.list_admin()

    @router.post(
        "/admin/blog/posts",
        response_model=BlogArticleResponse,
        status_code=201,
    )
    async def create_admin_post(
        payload: BlogArticleCreate,
        _=Depends(admin_dependency),
    ):
        return await service.create_article(payload)

    @router.put("/admin/blog/posts/{article_id}", response_model=BlogArticleResponse)
    async def update_admin_post(
        article_id: uuid.UUID,
        payload: BlogArticleUpdate,
        _=Depends(admin_dependency),
    ):
        return await service.update_article(str(article_id), payload)

    @router.delete("/admin/blog/posts/{article_id}", status_code=204)
    async def delete_admin_post(
        article_id: uuid.UUID,
        version: int = Query(ge=1, le=2**53 - 1),
        _=Depends(admin_dependency),
    ):
        await service.delete_article(str(article_id), version)

    @router.post("/admin/blog/media", status_code=201)
    async def upload_blog_media(
        file: UploadFile,
        _=Depends(admin_dependency),
    ):
        if file.content_type not in ALLOWED_BLOG_IMAGE_TYPES:
            raise HTTPException(
                status_code=415,
                detail="Fișierul trebuie să fie o imagine JPG, PNG, WebP sau AVIF.",
            )
        data = await file.read(MAX_BLOG_MEDIA_BYTES + 1)
        if len(data) > MAX_BLOG_MEDIA_BYTES:
            raise HTTPException(status_code=413, detail="Imaginea depășește 6 MB.")
        if not image_signature_matches(file.content_type, data):
            raise HTTPException(
                status_code=415,
                detail="Conținutul fișierului nu corespunde formatului imaginii.",
            )
        media_id = await service.media_store.save(
            file.filename or "coperta.webp",
            file.content_type,
            data,
        )
        return {
            "id": media_id,
            "url": f"/api/blog/media/{media_id}",
        }

    return router
