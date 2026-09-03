"""Service-level CMS workflows with a detached in-memory repository double."""

import asyncio
import os
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import ValidationError

from cms_models import SiteContent
from cms_repository import MongoCmsRepository
from cms_service import (
    BootstrapRefused,
    CmsNotInitialized,
    CmsService,
    DraftConflict,
    RevisionNotFound,
)
from test_cms_models import default_content as default_content_fixture


class Clock:
    def __init__(self):
        self.value = datetime(2026, 9, 3, 12, tzinfo=timezone.utc)

    def __call__(self):
        current = self.value
        self.value += timedelta(seconds=1)
        return current


class InMemoryCmsRepository:
    """A copy-on-read double that models the repository's atomic boundaries."""

    def __init__(self):
        self.draft = None
        self.publication = None
        self.revisions = []

    @staticmethod
    def _copy(value):
        return deepcopy(value) if value is not None else None

    async def get_draft(self):
        return self._copy(self.draft)

    async def get_publication(self):
        return self._copy(self.publication)

    async def get_revision(self, revision_id):
        return self._copy(next((item for item in self.revisions if item["id"] == revision_id), None))

    async def list_revisions(self, limit=100):
        return self._copy(sorted(self.revisions, key=lambda item: item["published_at"], reverse=True)[:limit])

    async def bootstrap_transaction(self, *, content, admin_id, revision_id, now):
        if self.publication:
            return {"created": False, "publication": self._copy(self.publication), "draft": self._copy(self.draft)}
        if self.draft:
            raise BootstrapRefused()
        revision = {
            "id": revision_id,
            "schema_version": content["schema_version"],
            "content": self._copy(content),
            "summary": "Inițializare conținut",
            "published_at": now,
            "published_by": admin_id,
        }
        self.publication = {
            "id": "current",
            "schema_version": content["schema_version"],
            "content": self._copy(content),
            "revision_id": revision_id,
            "published_at": now,
            "published_by": admin_id,
        }
        self.draft = {
            "id": "primary",
            "schema_version": content["schema_version"],
            "content": self._copy(content),
            "base_revision_id": revision_id,
            "version": 0,
            "updated_at": now,
            "updated_by": admin_id,
        }
        self.revisions.append(revision)
        return {"created": True, "publication": self._copy(self.publication), "draft": self._copy(self.draft)}

    async def create_draft_from_publication(self, *, publication, admin_id, now):
        if self.draft:
            return self._copy(self.draft)
        self.draft = {
            "id": "primary",
            "schema_version": publication["schema_version"],
            "content": self._copy(publication["content"]),
            "base_revision_id": publication["revision_id"],
            "version": 0,
            "updated_at": now,
            "updated_by": admin_id,
        }
        return self._copy(self.draft)

    async def update_draft(self, *, content, expected_version, admin_id, now, base_revision_id=None):
        if not self.draft or self.draft["version"] != expected_version:
            return None
        self.draft.update({
            "schema_version": content["schema_version"],
            "content": self._copy(content),
            "updated_at": now,
            "updated_by": admin_id,
        })
        if base_revision_id is not None:
            self.draft["base_revision_id"] = base_revision_id
        self.draft["version"] += 1
        return self._copy(self.draft)

    async def publish_transaction(self, *, expected_version, admin_id, revision_id, summary, now):
        if not self.draft or self.draft["version"] != expected_version:
            return None
        revision = {
            "id": revision_id,
            "schema_version": self.draft["schema_version"],
            "content": self._copy(self.draft["content"]),
            "summary": summary,
            "published_at": now,
            "published_by": admin_id,
        }
        self.revisions.append(revision)
        self.publication = {
            "id": "current",
            "schema_version": self.draft["schema_version"],
            "content": self._copy(self.draft["content"]),
            "revision_id": revision_id,
            "published_at": now,
            "published_by": admin_id,
        }
        self.draft.update({
            "base_revision_id": revision_id,
            "version": self.draft["version"] + 1,
            "updated_at": now,
            "updated_by": admin_id,
        })
        return {
            "draft": self._copy(self.draft),
            "publication": self._copy(self.publication),
            "revision": self._copy(revision),
        }


@pytest.fixture
def seed_content():
    return SiteContent.model_validate(default_content_fixture.__wrapped__())


@pytest.fixture
def cms_service():
    clock = Clock()
    ids = iter(["revision-initial", "revision-second", "revision-third", "revision-fourth"])
    return CmsService(InMemoryCmsRepository(), clock=clock, revision_id_factory=lambda: next(ids))


def updated_content(seed_content, *, name):
    payload = seed_content.model_dump(mode="json")
    payload["siteDetails"]["name"] = name
    return SiteContent.model_validate(payload)


@pytest.mark.asyncio
async def test_bootstrap_is_idempotent_and_never_overwrites_a_publication(cms_service, seed_content):
    first = await cms_service.bootstrap(seed_content, "administrator")
    second = await cms_service.bootstrap(updated_content(seed_content, name="Alt brand"), "alt-admin")

    assert first.created is True
    assert second.created is False
    public = await cms_service.get_publication()
    assert public.revision_id == "revision-initial"
    assert public.content.siteDetails.name == "FireArtRo"


@pytest.mark.asyncio
async def test_force_bootstrap_is_refused(cms_service, seed_content):
    with pytest.raises(BootstrapRefused):
        await cms_service.bootstrap(seed_content, "administrator", force=True)


@pytest.mark.asyncio
async def test_save_draft_uses_optimistic_version(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    saved = await cms_service.save_draft(seed_content, expected_version=0, admin_id="administrator")

    assert saved.version == 1
    with pytest.raises(DraftConflict):
        await cms_service.save_draft(seed_content, expected_version=0, admin_id="administrator")


@pytest.mark.asyncio
async def test_publish_is_atomic_and_creates_an_immutable_revision(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    result = await cms_service.publish(expected_version=0, admin_id="administrator", summary="Lansare")

    public = await cms_service.get_publication()
    revision = await cms_service.get_revision(result.publication.revision_id)
    assert result.draft.version == 1
    assert public.revision_id == result.publication.revision_id
    assert public.content == seed_content
    assert revision.summary == "Lansare"
    assert revision.content == seed_content


@pytest.mark.asyncio
async def test_invalid_draft_cannot_change_the_previous_public_revision(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    before = await cms_service.get_publication()
    repository = cms_service.repository
    repository.draft["content"]["packages"][0]["title"] = ""

    with pytest.raises(ValidationError):
        await cms_service.publish(expected_version=0, admin_id="administrator")

    assert await cms_service.get_publication() == before
    assert len(repository.revisions) == 1


@pytest.mark.asyncio
async def test_revision_list_is_newest_first_and_unknown_revision_is_explicit(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    changed = updated_content(seed_content, name="FireArtRo nou")
    await cms_service.save_draft(changed, expected_version=0, admin_id="administrator")
    second = await cms_service.publish(expected_version=1, admin_id="administrator", summary="Versiunea a doua")
    changed_again = updated_content(changed, name="FireArtRo final")
    await cms_service.save_draft(changed_again, expected_version=second.draft.version, admin_id="administrator")
    third = await cms_service.publish(expected_version=3, admin_id="administrator", summary="Versiunea a treia")

    revisions = await cms_service.list_revisions()
    assert [revision.id for revision in revisions] == [third.publication.revision_id, second.publication.revision_id, "revision-initial"]
    with pytest.raises(RevisionNotFound):
        await cms_service.get_revision("revision-lipsă")


@pytest.mark.asyncio
async def test_restore_creates_a_new_draft_without_changing_publication(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    changed = updated_content(seed_content, name="Conținut public nou")
    await cms_service.save_draft(changed, expected_version=0, admin_id="administrator")
    published = await cms_service.publish(expected_version=1, admin_id="administrator")
    public_before_restore = await cms_service.get_publication()

    restored = await cms_service.restore_revision(
        "revision-initial",
        expected_version=published.draft.version,
        admin_id="administrator",
    )

    assert restored.version == published.draft.version + 1
    assert restored.base_revision_id == "revision-initial"
    assert restored.content == seed_content
    assert await cms_service.get_publication() == public_before_restore


@pytest.mark.asyncio
async def test_get_or_create_draft_copies_only_the_current_publication(cms_service, seed_content):
    await cms_service.bootstrap(seed_content, "administrator")
    cms_service.repository.draft = None

    draft = await cms_service.get_or_create_draft("administrator")
    assert draft.version == 0
    assert draft.base_revision_id == "revision-initial"
    assert draft.content == seed_content

    empty_service = CmsService(InMemoryCmsRepository())
    with pytest.raises(CmsNotInitialized):
        await empty_service.get_or_create_draft("administrator")


@pytest_asyncio.fixture
async def real_cms_domain():
    uri = os.environ.get("FIREART_AUTH_TEST_MONGO_URI")
    if not uri:
        pytest.skip("Explicit isolated Mongo opt-in required")
    assert uri == "mongodb://127.0.0.1:27183/?replicaSet=testset"
    database_name = "fireartro_cms_test_content_" + uuid.uuid4().hex
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3_000)
    try:
        assert (await client.admin.command("hello"))["setName"] == "testset"
        database = client[database_name]
        repository = MongoCmsRepository(
            drafts=database.site_content_drafts,
            publications=database.site_content_publications,
            revisions=database.site_content_revisions,
            client=client,
        )
        await repository.create_indexes()
        clock = Clock()
        ids = iter([f"revision-{number}" for number in range(1, 20)])
        yield SimpleNamespace(
            database=database,
            repository=repository,
            service=CmsService(repository, clock=clock, revision_id_factory=lambda: next(ids)),
        )
    finally:
        assert database_name.startswith("fireartro_cms_test_content_")
        assert len(database_name.removeprefix("fireartro_cms_test_content_")) == 32
        await client.drop_database(database_name)
        client.close()


@pytest.mark.asyncio
async def test_real_mongo_bootstrap_and_publish_are_atomic(real_cms_domain, seed_content):
    initialized = await real_cms_domain.service.bootstrap(seed_content, "administrator")
    published = await real_cms_domain.service.publish(
        expected_version=initialized.draft.version,
        admin_id="administrator",
        summary="Prima publicare",
    )

    assert await real_cms_domain.database.site_content_revisions.count_documents({}) == 2
    assert await real_cms_domain.database.site_content_publications.count_documents({"id": "current"}) == 1
    stored_draft = await real_cms_domain.database.site_content_drafts.find_one({"id": "primary"})
    assert stored_draft["version"] == 1
    assert stored_draft["base_revision_id"] == published.publication.revision_id
    assert published.publication.content == seed_content


@pytest.mark.asyncio
async def test_real_mongo_simultaneous_editors_cannot_overwrite_each_other(real_cms_domain, seed_content):
    await real_cms_domain.service.bootstrap(seed_content, "administrator")
    first = updated_content(seed_content, name="Editorul unu")
    second = updated_content(seed_content, name="Editorul doi")

    outcomes = await asyncio.gather(
        real_cms_domain.service.save_draft(first, expected_version=0, admin_id="editor-unu"),
        real_cms_domain.service.save_draft(second, expected_version=0, admin_id="editor-doi"),
        return_exceptions=True,
    )

    assert sum(isinstance(item, DraftConflict) for item in outcomes) == 1
    assert sum(not isinstance(item, Exception) for item in outcomes) == 1
    stored = await real_cms_domain.service.get_or_create_draft("administrator")
    assert stored.version == 1
    assert stored.content.siteDetails.name in {"Editorul unu", "Editorul doi"}


@pytest.mark.asyncio
async def test_real_mongo_stale_publish_does_not_create_an_extra_revision(real_cms_domain, seed_content):
    await real_cms_domain.service.bootstrap(seed_content, "administrator")
    await real_cms_domain.service.save_draft(
        updated_content(seed_content, name="Ciornă mai nouă"),
        expected_version=0,
        admin_id="administrator",
    )

    with pytest.raises(DraftConflict):
        await real_cms_domain.service.publish(expected_version=0, admin_id="administrator")

    assert await real_cms_domain.database.site_content_revisions.count_documents({}) == 1
    assert await real_cms_domain.database.site_content_publications.count_documents({}) == 1
