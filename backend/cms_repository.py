"""Mongo persistence primitives for FireArtRo's versioned site content."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Protocol

from pymongo import ReturnDocument


PRIMARY_DRAFT_ID = "primary"
CURRENT_PUBLICATION_ID = "current"


class RepositoryDraftConflict(Exception):
    """The expected draft version changed before a repository mutation."""


class RepositoryBootstrapConflict(Exception):
    """A non-atomic legacy draft prevents a safe one-time bootstrap."""


class CmsRepository(Protocol):
    async def get_draft(self) -> dict[str, Any] | None: ...
    async def get_publication(self) -> dict[str, Any] | None: ...
    async def get_revision(self, revision_id: str) -> dict[str, Any] | None: ...
    async def list_revisions(self, limit: int = 100) -> list[dict[str, Any]]: ...
    async def bootstrap_transaction(self, **kwargs) -> dict[str, Any]: ...
    async def create_draft_from_publication(self, **kwargs) -> dict[str, Any]: ...
    async def update_draft(self, **kwargs) -> dict[str, Any] | None: ...
    async def publish_transaction(self, **kwargs) -> dict[str, Any]: ...


def _clean(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if document is None:
        return None
    copied = deepcopy(document)
    copied.pop("_id", None)
    return copied


class MongoCmsRepository:
    """Atomic MongoDB storage for the one editable draft and public snapshot."""

    def __init__(self, *, drafts, publications, revisions, client=None):
        self.drafts = drafts
        self.publications = publications
        self.revisions = revisions
        self.client = client or (drafts.database.client if drafts is not None else None)

    async def create_indexes(self) -> None:
        await self.drafts.create_index("id", unique=True)
        await self.publications.create_index("id", unique=True)
        await self.revisions.create_index("id", unique=True)
        await self.revisions.create_index([("published_at", -1)])

    async def get_draft(self) -> dict[str, Any] | None:
        return _clean(await self.drafts.find_one({"id": PRIMARY_DRAFT_ID}))

    async def get_publication(self) -> dict[str, Any] | None:
        return _clean(await self.publications.find_one({"id": CURRENT_PUBLICATION_ID}))

    async def get_revision(self, revision_id: str) -> dict[str, Any] | None:
        return _clean(await self.revisions.find_one({"id": revision_id}))

    async def list_revisions(self, limit: int = 100) -> list[dict[str, Any]]:
        cursor = self.revisions.find({}, {"_id": 0, "content": 0}).sort("published_at", -1).limit(limit)
        return [dict(item) async for item in cursor]

    async def bootstrap_transaction(self, *, content, admin_id, revision_id, now) -> dict[str, Any]:
        """Create the first revision, public snapshot, and draft together only once."""

        async def transaction(session):
            publication = await self.publications.find_one(
                {"id": CURRENT_PUBLICATION_ID}, session=session,
            )
            if publication:
                draft = await self.drafts.find_one({"id": PRIMARY_DRAFT_ID}, session=session)
                return {"created": False, "publication": _clean(publication), "draft": _clean(draft)}

            existing_draft = await self.drafts.find_one({"id": PRIMARY_DRAFT_ID}, session=session)
            if existing_draft:
                raise RepositoryBootstrapConflict()

            revision = {
                "id": revision_id,
                "schema_version": content["schema_version"],
                "content": deepcopy(content),
                "summary": "Inițializare conținut",
                "published_at": now,
                "published_by": admin_id,
            }
            publication = {
                "id": CURRENT_PUBLICATION_ID,
                "schema_version": content["schema_version"],
                "content": deepcopy(content),
                "revision_id": revision_id,
                "published_at": now,
                "published_by": admin_id,
            }
            draft = {
                "id": PRIMARY_DRAFT_ID,
                "schema_version": content["schema_version"],
                "content": deepcopy(content),
                "base_revision_id": revision_id,
                "version": 0,
                "updated_at": now,
                "updated_by": admin_id,
            }
            await self.revisions.insert_one(revision, session=session)
            await self.publications.insert_one(publication, session=session)
            await self.drafts.insert_one(draft, session=session)
            return {"created": True, "publication": _clean(publication), "draft": _clean(draft)}

        async with await self.client.start_session() as session:
            return await session.with_transaction(transaction)

    async def create_draft_from_publication(self, *, publication, admin_id, now) -> dict[str, Any]:
        document = {
            "id": PRIMARY_DRAFT_ID,
            "schema_version": publication["schema_version"],
            "content": deepcopy(publication["content"]),
            "base_revision_id": publication["revision_id"],
            "version": 0,
            "updated_at": now,
            "updated_by": admin_id,
        }
        saved = await self.drafts.find_one_and_update(
            {"id": PRIMARY_DRAFT_ID},
            {"$setOnInsert": document},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return _clean(saved)

    async def update_draft(
        self,
        *,
        content,
        expected_version: int,
        admin_id: str,
        now,
        base_revision_id: str | None = None,
    ) -> dict[str, Any] | None:
        fields = {
            "schema_version": content["schema_version"],
            "content": deepcopy(content),
            "updated_at": now,
            "updated_by": admin_id,
        }
        if base_revision_id is not None:
            fields["base_revision_id"] = base_revision_id
        saved = await self.drafts.find_one_and_update(
            {"id": PRIMARY_DRAFT_ID, "version": expected_version},
            {"$set": fields, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return _clean(saved)

    async def publish_transaction(
        self,
        *,
        expected_version: int,
        admin_id: str,
        revision_id: str,
        summary: str,
        now,
    ) -> dict[str, Any]:
        """Promote one exact draft version, preserving all three documents together."""

        async def transaction(session):
            draft = await self.drafts.find_one(
                {"id": PRIMARY_DRAFT_ID, "version": expected_version},
                session=session,
            )
            if not draft:
                raise RepositoryDraftConflict()

            revision = {
                "id": revision_id,
                "schema_version": draft["schema_version"],
                "content": deepcopy(draft["content"]),
                "summary": summary,
                "published_at": now,
                "published_by": admin_id,
            }
            publication = {
                "id": CURRENT_PUBLICATION_ID,
                "schema_version": draft["schema_version"],
                "content": deepcopy(draft["content"]),
                "revision_id": revision_id,
                "published_at": now,
                "published_by": admin_id,
            }
            await self.revisions.insert_one(revision, session=session)
            await self.publications.replace_one(
                {"id": CURRENT_PUBLICATION_ID},
                publication,
                upsert=True,
                session=session,
            )
            saved_draft = await self.drafts.find_one_and_update(
                {"id": PRIMARY_DRAFT_ID, "version": expected_version},
                {
                    "$set": {
                        "base_revision_id": revision_id,
                        "updated_at": now,
                        "updated_by": admin_id,
                    },
                    "$inc": {"version": 1},
                },
                return_document=ReturnDocument.AFTER,
                projection={"_id": 0},
                session=session,
            )
            if not saved_draft:
                raise RepositoryDraftConflict()
            return {
                "draft": _clean(saved_draft),
                "publication": _clean(publication),
                "revision": _clean(revision),
            }

        async with await self.client.start_session() as session:
            return await session.with_transaction(transaction)
