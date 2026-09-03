"""Application rules for draft autosave, atomic publication, and restore."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from cms_models import (
    DraftResponse,
    PublicationResponse,
    PublishRequest,
    RevisionResponse,
    RevisionSummary,
    SiteContent,
)
from cms_repository import RepositoryBootstrapConflict, RepositoryDraftConflict


class CmsNotInitialized(Exception):
    """No public content has been bootstrapped yet."""


class DraftConflict(Exception):
    """An editor is trying to save or publish a stale draft version."""


class RevisionNotFound(Exception):
    """The requested immutable historical snapshot does not exist."""


class BootstrapRefused(Exception):
    """Bootstrap may never force-overwrite public content or a partial draft."""


@dataclass(frozen=True)
class BootstrapResult:
    created: bool
    publication: PublicationResponse
    draft: DraftResponse


@dataclass(frozen=True)
class PublishResult:
    publication: PublicationResponse
    draft: DraftResponse
    revision: RevisionResponse


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CmsService:
    def __init__(self, repository, *, clock: Callable[[], datetime] = utc_now, revision_id_factory: Callable[[], str] | None = None):
        self.repository = repository
        self.clock = clock
        self.revision_id_factory = revision_id_factory or (lambda: str(uuid4()))

    @staticmethod
    def _content(value) -> SiteContent:
        return value if isinstance(value, SiteContent) else SiteContent.model_validate(value)

    @staticmethod
    def _content_document(content: SiteContent) -> dict:
        return content.model_dump(mode="json")

    def _publication_response(self, document) -> PublicationResponse:
        if not document:
            raise CmsNotInitialized()
        return PublicationResponse(
            revision_id=document["revision_id"],
            published_at=document["published_at"],
            content=self._content(document["content"]),
        )

    def _draft_response(self, document, publication=None) -> DraftResponse:
        if not document:
            raise CmsNotInitialized()
        return DraftResponse(
            version=document["version"],
            base_revision_id=document.get("base_revision_id"),
            published_revision_id=(publication or {}).get("revision_id"),
            published_at=(publication or {}).get("published_at"),
            content=self._content(document["content"]),
            updated_at=document["updated_at"],
            updated_by=document["updated_by"],
        )

    def _revision_response(self, document) -> RevisionResponse:
        if not document:
            raise RevisionNotFound()
        return RevisionResponse(
            id=document["id"],
            summary=document.get("summary", ""),
            published_at=document["published_at"],
            published_by=document["published_by"],
            content=self._content(document["content"]),
        )

    async def get_publication(self) -> PublicationResponse:
        return self._publication_response(await self.repository.get_publication())

    async def get_or_create_draft(self, admin_id: str) -> DraftResponse:
        publication = await self.repository.get_publication()
        if not publication:
            raise CmsNotInitialized()
        draft = await self.repository.get_draft()
        if not draft:
            # Validate before a recovery draft is copied from the current public snapshot.
            publication["content"] = self._content_document(self._content(publication["content"]))
            draft = await self.repository.create_draft_from_publication(
                publication=publication,
                admin_id=admin_id,
                now=self.clock(),
            )
        return self._draft_response(draft, publication)

    async def bootstrap(self, seed_content, admin_id: str, *, force: bool = False) -> BootstrapResult:
        if force:
            raise BootstrapRefused()
        content = self._content(seed_content)
        now = self.clock()
        try:
            result = await self.repository.bootstrap_transaction(
                content=self._content_document(content),
                admin_id=admin_id,
                revision_id=self.revision_id_factory(),
                now=now,
            )
        except RepositoryBootstrapConflict as exc:
            raise BootstrapRefused() from exc

        publication = result.get("publication")
        if not publication:
            raise CmsNotInitialized()
        draft = result.get("draft")
        if not draft:
            draft = await self.repository.create_draft_from_publication(
                publication=publication,
                admin_id=admin_id,
                now=now,
            )
        return BootstrapResult(
            created=bool(result.get("created")),
            publication=self._publication_response(publication),
            draft=self._draft_response(draft, publication),
        )

    async def save_draft(self, content, *, expected_version: int, admin_id: str) -> DraftResponse:
        canonical = self._content(content)
        saved = await self.repository.update_draft(
            content=self._content_document(canonical),
            expected_version=expected_version,
            admin_id=admin_id,
            now=self.clock(),
        )
        if not saved:
            raise DraftConflict()
        return self._draft_response(saved, await self.repository.get_publication())

    async def publish(self, *, expected_version: int, admin_id: str, summary: str = "") -> PublishResult:
        draft = await self.repository.get_draft()
        if not draft or draft.get("version") != expected_version:
            raise DraftConflict()

        # Validate the exact draft that was observed before attempting the CAS transaction.
        self._content(draft["content"])
        request = PublishRequest(version=expected_version, summary=summary)
        try:
            result = await self.repository.publish_transaction(
                expected_version=request.version,
                admin_id=admin_id,
                revision_id=self.revision_id_factory(),
                summary=request.summary,
                now=self.clock(),
            )
        except RepositoryDraftConflict as exc:
            raise DraftConflict() from exc
        if not result:
            raise DraftConflict()
        return PublishResult(
            publication=self._publication_response(result["publication"]),
            draft=self._draft_response(result["draft"], result["publication"]),
            revision=self._revision_response(result["revision"]),
        )

    async def list_revisions(self, limit: int = 100) -> list[RevisionSummary]:
        documents = await self.repository.list_revisions(limit=limit)
        return [
            RevisionSummary(
                id=document["id"],
                summary=document.get("summary", ""),
                published_at=document["published_at"],
                published_by=document["published_by"],
            )
            for document in documents
        ]

    async def get_revision(self, revision_id: str) -> RevisionResponse:
        return self._revision_response(await self.repository.get_revision(revision_id))

    async def restore_revision(self, revision_id: str, *, expected_version: int, admin_id: str) -> DraftResponse:
        revision = await self.repository.get_revision(revision_id)
        restored = self._revision_response(revision)
        saved = await self.repository.update_draft(
            content=self._content_document(restored.content),
            expected_version=expected_version,
            admin_id=admin_id,
            now=self.clock(),
            base_revision_id=restored.id,
        )
        if not saved:
            raise DraftConflict()
        return self._draft_response(saved, await self.repository.get_publication())
