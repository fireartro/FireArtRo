"""Public and session-protected HTTP routes for versioned site content."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response

from auth import AdminIdentity, require_admin_session
from cms_models import (
    DraftResponse,
    DraftUpdate,
    PublicationResponse,
    PublishRequest,
    PublishResponse,
    RestoreRequest,
    RevisionResponse,
    RevisionSummary,
    SiteContent,
)
from cms_service import BootstrapRefused, CmsNotInitialized, CmsService, DraftConflict, RevisionNotFound


REVISION_ID = Annotated[
    str,
    Path(
        min_length=1,
        max_length=80,
        pattern=r"^[a-z0-9][a-z0-9-]{0,79}$",
        description="Identificatorul unei versiuni publicate.",
    ),
]
PUBLIC_CACHE_CONTROL = "no-cache, must-revalidate"
ADMIN_CACHE_CONTROL = "no-store"
CMS_CONTENT_WRITE_MAX_BYTES = 1 * 1024 * 1024


def is_cms_content_write(path: str, method: str) -> bool:
    return path.startswith("/api/admin/content/") and method.upper() in {"POST", "PUT"}


def _etag_matches(value: str | None, etag: str) -> bool:
    """Handle a revalidation list without accepting arbitrary partial values."""

    if not value:
        return False
    for candidate in value.split(","):
        normalized = candidate.strip()
        if normalized == "*" or normalized.removeprefix("W/") == etag:
            return True
    return False


def _not_initialized(*, admin: bool = False) -> None:
    raise HTTPException(
        status_code=404,
        detail="Conținutul public nu este inițializat încă.",
        headers={"Cache-Control": ADMIN_CACHE_CONTROL if admin else PUBLIC_CACHE_CONTROL},
    )


def _draft_conflict() -> None:
    raise HTTPException(
        status_code=409,
        detail="Ciorna a fost modificată într-o versiune mai nouă. Reîncarcă înainte de a salva.",
        headers={"Cache-Control": ADMIN_CACHE_CONTROL},
    )


def _revision_not_found() -> None:
    raise HTTPException(
        status_code=404,
        detail="Versiunea solicitată nu există.",
        headers={"Cache-Control": ADMIN_CACHE_CONTROL},
    )


def _admin_no_store(response: Response) -> None:
    response.headers["Cache-Control"] = ADMIN_CACHE_CONTROL


def create_cms_router(service: CmsService) -> APIRouter:
    """Build a router around one service instance; mounting belongs to server.py."""

    router = APIRouter(tags=["content"])

    @router.post("/api/admin/content/bootstrap")
    async def bootstrap_content(
        content: SiteContent,
        response: Response,
        identity: AdminIdentity = Depends(require_admin_session),
    ):
        _admin_no_store(response)
        try:
            result = await service.bootstrap(content, admin_id=identity.username)
        except BootstrapRefused:
            raise HTTPException(status_code=409, detail="Inițializarea nu poate suprascrie conținut existent.")
        return {"created": result.created, "publication": result.publication, "draft": result.draft}

    @router.get("/api/content", response_model=PublicationResponse)
    async def get_public_content(request: Request, response: Response):
        try:
            publication = await service.get_publication()
        except CmsNotInitialized:
            _not_initialized()
        etag = f'"{publication.revision_id}"'
        if _etag_matches(request.headers.get("if-none-match"), etag):
            return Response(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": PUBLIC_CACHE_CONTROL},
            )
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
        return publication

    @router.get("/api/admin/content/draft", response_model=DraftResponse)
    async def get_draft(response: Response, identity: AdminIdentity = Depends(require_admin_session)):
        _admin_no_store(response)
        try:
            return await service.get_or_create_draft(identity.username)
        except CmsNotInitialized:
            _not_initialized(admin=True)

    @router.put("/api/admin/content/draft", response_model=DraftResponse)
    async def save_draft(
        update: DraftUpdate,
        response: Response,
        identity: AdminIdentity = Depends(require_admin_session),
    ):
        _admin_no_store(response)
        try:
            return await service.save_draft(
                update.content,
                expected_version=update.version,
                admin_id=identity.username,
            )
        except DraftConflict:
            _draft_conflict()

    @router.post("/api/admin/content/publish", response_model=PublishResponse)
    async def publish_content(
        request: PublishRequest,
        response: Response,
        identity: AdminIdentity = Depends(require_admin_session),
    ):
        _admin_no_store(response)
        try:
            result = await service.publish(
                expected_version=request.version,
                admin_id=identity.username,
                summary=request.summary,
            )
        except CmsNotInitialized:
            _not_initialized(admin=True)
        except DraftConflict:
            _draft_conflict()
        return PublishResponse(
            publication=result.publication,
            draft=result.draft,
            revision=result.revision,
        )

    @router.get("/api/admin/content/revisions", response_model=list[RevisionSummary])
    async def list_revisions(response: Response, _: AdminIdentity = Depends(require_admin_session)):
        _admin_no_store(response)
        return await service.list_revisions()

    @router.get("/api/admin/content/revisions/{revision_id}", response_model=RevisionResponse)
    async def get_revision(
        revision_id: REVISION_ID,
        response: Response,
        _: AdminIdentity = Depends(require_admin_session),
    ):
        _admin_no_store(response)
        try:
            return await service.get_revision(revision_id)
        except RevisionNotFound:
            _revision_not_found()

    @router.post(
        "/api/admin/content/revisions/{revision_id}/restore",
        response_model=DraftResponse,
    )
    async def restore_revision(
        revision_id: REVISION_ID,
        request: RestoreRequest,
        response: Response,
        identity: AdminIdentity = Depends(require_admin_session),
    ):
        _admin_no_store(response)
        try:
            return await service.restore_revision(
                revision_id,
                expected_version=request.version,
                admin_id=identity.username,
            )
        except RevisionNotFound:
            _revision_not_found()
        except DraftConflict:
            _draft_conflict()

    return router
