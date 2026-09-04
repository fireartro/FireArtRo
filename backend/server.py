from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pymongo.errors import PyMongoError
import asyncio
from contextlib import asynccontextmanager
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from blog import (
    BlogService,
    GridFsBlogMediaStore,
    MongoBlogRepository,
    create_blog_router,
    request_size_limit,
)
from cms_repository import MongoCmsRepository
from cms_routes import (
    CMS_CONTENT_WRITE_MAX_BYTES,
    create_cms_router,
    is_cms_content_write,
)
from cms_service import CmsService
from reviews import ReviewsService, create_reviews_router
from auth import (
    AuthError,
    AUTH_UNAVAILABLE,
    AuthService,
    MongoSessionRepository,
    MongoLoginAttemptRepository,
    create_auth_router,
    request_ip,
)
from quote_admin import (
    NOTIFICATION_FROM,
    NOTIFICATION_TO,
    MongoQuoteRateLimiter,
    MongoQuoteRepository,
    QuoteNotificationService,
    create_quote_admin_router,
)
from email_inbox import MongoEmailDeliveryRepository
from resend_email import ResendClient, ResendConfig, ResendError
from media import (
    MediaService,
    MediaWriteGuardMiddleware,
    MongoMediaRepository,
    VercelBlobClient,
    create_media_router,
)
from integrations import IntegrationsService, create_integrations_router


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Missing/invalid configuration must leave a diagnosable app, never an implicit
# localhost connection. MONGO_URL is a temporary compatibility alias.
mongo_url = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URL", "")
database_name = os.environ.get("DB_NAME", "")
database_configuration_errors = []
client = None
db = None
if not mongo_url.strip():
    database_configuration_errors.append("MONGODB_URI")
if not database_name.strip():
    database_configuration_errors.append("DB_NAME")
if not database_configuration_errors:
    try:
        client = AsyncIOMotorClient(
            mongo_url,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=2000,
        )
    except (PyMongoError, ValueError):
        database_configuration_errors.append("MONGODB_URI")
    if client is not None:
        try:
            db = client[database_name]
        except (PyMongoError, ValueError):
            database_configuration_errors.append("DB_NAME")
            client.close()
            client = None


def _email_config():
    try:
        configured = ResendConfig.from_env()
    except ResendError:
        return ResendConfig(
            enabled=False,
            api_key="",
            webhook_secret="",
            from_email="",
            notification_to="",
            inbound_domain="",
            inbound_address="",
        )
    if not configured.enabled:
        return configured
    return configured.model_copy(
        update={"from_email": NOTIFICATION_FROM, "notification_to": NOTIFICATION_TO}
    )


resend_http_client = httpx.AsyncClient()
resend_client = ResendClient(_email_config(), http_client=resend_http_client)
quote_delivery_repository = MongoEmailDeliveryRepository(
    db.email_deliveries if db is not None else None
)
quote_notification_service = QuoteNotificationService(
    resend_client, quote_delivery_repository if db is not None else None
)

cms_repository = MongoCmsRepository(
    drafts=db.site_content_drafts if db is not None else None,
    publications=db.site_content_publications if db is not None else None,
    revisions=db.site_content_revisions if db is not None else None,
    client=client,
)
cms_service = CmsService(cms_repository)
quote_repository = MongoQuoteRepository(
    db.quotes if db is not None else None,
    delivery_repository=quote_delivery_repository if db is not None else None,
)
quote_rate_limiter = MongoQuoteRateLimiter(
    db.quote_rate_limits if db is not None else None,
    os.environ.get("ADMIN_SESSION_SECRET", ""),
)
media_repository = MongoMediaRepository(db)
media_service = MediaService(media_repository, VercelBlobClient())


async def ensure_indexes():
    await db.blog_posts.create_index("slug", unique=True)
    await db.blog_posts.create_index([("status", 1), ("published_at", -1)])
    await db.admin_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.admin_sessions.create_index("token_hash", unique=True)
    await db.admin_login_attempts.create_index("expires_at", expireAfterSeconds=0)
    await cms_repository.create_indexes()
    await quote_repository.create_indexes()
    await quote_delivery_repository.create_indexes()
    await quote_rate_limiter.create_indexes()
    await media_repository.create_indexes()


@asynccontextmanager
async def lifespan(application):
    application.state.indexes_ready = False
    try:
        if db is not None:
            try:
                await asyncio.wait_for(ensure_indexes(), timeout=5)
                application.state.indexes_ready = True
            except (PyMongoError, asyncio.TimeoutError):
                # No exception text: it can contain connection strings/hosts.
                logger.error("Database index initialization unavailable")
        yield
    finally:
        application.state.indexes_ready = False
        if client is not None:
            client.close()
        await resend_http_client.aclose()


# Create the main app without a prefix
app = FastAPI(title="FireArtRo API", lifespan=lifespan)
app.state.indexes_ready = False
auth_service = AuthService(
    sessions=MongoSessionRepository(db.admin_sessions if db is not None else None),
    attempts=MongoLoginAttemptRepository(
        db.admin_login_attempts if db is not None else None
    ),
    username=os.environ.get("ADMIN_USERNAME", ""),
    password_hash=os.environ.get("ADMIN_PASSWORD_HASH", ""),
    session_secret=os.environ.get("ADMIN_SESSION_SECRET", ""),
)
app.state.auth_service = auth_service
app.state.cms_service = cms_service


async def require_auth_ready():
    if db is None or not app.state.indexes_ready:
        raise AuthError(AUTH_UNAVAILABLE, 503)


app.include_router(
    create_auth_router(auth_service), dependencies=[Depends(require_auth_ready)]
)
app.include_router(create_cms_router(cms_service))

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class QuoteCreate(BaseModel):
    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=7, max_length=30)
    email: str = Field(min_length=5, max_length=160)
    locality: str = Field(min_length=2, max_length=120)
    event_location: Optional[str] = Field(default="", max_length=180)
    event_type: str = Field(min_length=2, max_length=80)
    event_date: str = Field(min_length=8, max_length=40)
    services: List[str] = Field(min_length=1, max_length=12)
    package_id: Optional[str] = Field(default="", max_length=100)
    package_title: Optional[str] = Field(default="", max_length=120)
    message: Optional[str] = Field(default="", max_length=3000)
    consent: bool = False
    company_website: Optional[str] = Field(default="", max_length=200)

    @field_validator(
        "first_name",
        "last_name",
        "phone",
        "locality",
        "event_location",
        "event_type",
        "package_id",
        "package_title",
        "message",
        "company_website",
    )
    @classmethod
    def normalize_text(cls, value):
        return " ".join((value or "").strip().split())

    @field_validator("services")
    @classmethod
    def normalize_services(cls, values):
        normalized = [
            " ".join(value.strip().split())
            for value in values
            if value and value.strip()
        ]
        return list(dict.fromkeys(normalized))

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = (value or "").strip().lower()
        if value and ("@" not in value or "." not in value.rsplit("@", 1)[-1]):
            raise ValueError("Adresa de email nu este validă.")
        return value


class Quote(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    last_name: str
    phone: str
    email: str
    locality: str
    event_location: str = ""
    event_type: str
    event_date: str
    services: List[str] = Field(default_factory=list)
    package_id: str = ""
    package_title: str = ""
    message: str = ""
    consent: bool = False
    status: str = "new"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuoteAcknowledgement(BaseModel):
    accepted: bool = True


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "FireArtRo API"}


@api_router.get("/health")
async def health():
    configuration_errors = [
        *database_configuration_errors,
        *auth_service.configuration_errors,
    ]
    database_state = "not_configured" if db is None else "not_checked"
    if db is not None and not configuration_errors:
        try:
            await asyncio.wait_for(db.command("ping"), timeout=2)
            database_state = "ready"
        except (PyMongoError, asyncio.TimeoutError):
            database_state = "unavailable"
    ready = (
        not configuration_errors
        and database_state == "ready"
        and app.state.indexes_ready
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "configuration_errors": configuration_errors,
            "database": database_state,
            "indexes": "ready" if app.state.indexes_ready else "not_ready",
        },
        headers={"Cache-Control": "no-store"},
    )


@api_router.post("/quotes", response_model=QuoteAcknowledgement)
async def create_quote(input: QuoteCreate, request: Request):
    if not input.consent:
        raise HTTPException(status_code=422, detail="Consimțământul este obligatoriu.")
    await quote_rate_limiter.enforce(request_ip(request))
    payload = input.model_dump(exclude={"company_website"})
    quote = Quote(**payload)
    if input.company_website:
        return QuoteAcknowledgement()
    doc = quote.model_dump()
    doc["internal_note"] = ""
    doc["version"] = 0
    await db.quotes.insert_one(doc)
    await quote_notification_service.notify(quote)
    return QuoteAcknowledgement()


# Include the router in the main app
app.include_router(api_router)
app.include_router(
    create_quote_admin_router(quote_repository, quote_notification_service)
)
app.include_router(create_media_router(media_service))

blog_repository = MongoBlogRepository(db.blog_posts if db is not None else None)
blog_media_store = GridFsBlogMediaStore(
    AsyncIOMotorGridFSBucket(db, bucket_name="blog_media") if db is not None else None
)
blog_service = BlogService(blog_repository, blog_media_store)
app.include_router(create_blog_router(blog_service))

reviews_service = ReviewsService(os.environ)
app.include_router(create_reviews_router(reviews_service))
integration_service = IntegrationsService(db, reviews_service, os.environ)
app.state.integration_service = integration_service
app.include_router(create_integrations_router(integration_service))


class RequestSecurityMiddleware:
    """Bound the streamed body before any parser or login can consume it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        maximum = (
            4096
            if path.startswith("/api/admin/auth/")
            else (
                CMS_CONTENT_WRITE_MAX_BYTES
                if is_cms_content_write(path, scope["method"])
                else request_size_limit(path, scope["method"])
            )
        )

        async def secure_send(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                if (
                    path not in {"/api/content"}
                    and not path.startswith("/api/blog/media/")
                ) or message["status"] >= 400:
                    headers["Cache-Control"] = "no-store"
            await send(message)

        async def reject(status, detail):
            await JSONResponse(status_code=status, content={"detail": detail})(
                scope, receive, secure_send
            )

        lengths = [
            value
            for name, value in scope["headers"]
            if name.lower() == b"content-length"
        ]
        if lengths:
            if len(lengths) != 1 or not lengths[0].isdigit():
                await reject(400, "Content-Length invalid.")
                return
            # Avoid int() on an arbitrarily long attacker-controlled digit string.
            length = lengths[0].lstrip(b"0") or b"0"
            if len(length) > len(str(maximum)) or int(length) > maximum:
                await reject(413, "Cererea este prea mare.")
                return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > maximum:
                await reject(413, "Cererea este prea mare.")
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        if db is None and (
            path == "/api/content"
            or path.startswith(("/api/quotes", "/api/blog/", "/api/admin/"))
        ):
            await reject(503, "Serviciul nu este disponibil momentan.")
            return

        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, secure_send)


allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "https://www.fireartro.ro").split(",")
    if origin.strip()
]

# Starlette adds the newest middleware as the outermost layer.  Keep the
# streamed-body limiter outside the media write guard: an oversized request
# must be rejected before authentication or a write lock can inspect it.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.add_middleware(MediaWriteGuardMiddleware, service=media_service)
app.add_middleware(RequestSecurityMiddleware)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
