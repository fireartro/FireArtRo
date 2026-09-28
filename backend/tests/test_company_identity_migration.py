"""The owner's correction must reach storage, not merely frontend defaults."""

from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from test_cms_models import default_content as default_content_fixture


def legacy_content():
    content = default_content_fixture.__wrapped__()
    content["siteDetails"].update(
        {
            "legalName": "1A SMART LAND SOLUTIONS SRL",
            "registrationNumber": "J2022000693301",
            "taxId": "46367383",
            "registeredOffice": "Piața Soarelui, Bl. UU6, et. 3, ap. 9, Satu Mare",
            "mainOffice": "Piața Unirii nr. 2, Seini, județul Maramureș",
            "secondaryOffice": "Satu Mare",
            "shareCapital": "200 lei",
        }
    )
    identity = (
        "1A SMART LAND SOLUTIONS SRL, CUI 46367383, nr. Registrul Comerțului "
        "J2022000693301, cu sediul social în "
        "Piața Soarelui, Bl. UU6, et. 3, ap. 9, Satu Mare."
    )
    for page in content["legalPages"].values():
        page["sections"][0]["paragraphs"].insert(0, identity)
    return content


def test_certificate_corrects_all_legal_documents_without_mutating_the_input():
    from content_migrations import migrate_company_content

    before = legacy_content()
    original = deepcopy(before)
    corrected = migrate_company_content(before)
    details = corrected["siteDetails"]
    assert details["legalName"] == "1A FIREARTRO EVENTS S.R.L."
    assert details["taxId"] == "43337078"
    assert details["registrationNumber"] == "J12/3784/16.11.2020"
    assert details["registeredOffice"] == (
        "Strada Oltului nr. 1, camera nr. 1, et. 1, ap. 4, "
        "Cluj-Napoca, județul Cluj, România"
    )
    assert details["mainOffice"] == "Piața Unirii nr. 2, Seini, județul Maramureș"
    assert not details["secondaryOffice"]
    assert "shareCapital" not in details
    for page in corrected["legalPages"].values():
        paragraph = page["sections"][0]["paragraphs"][0]
        assert "1A FIREARTRO EVENTS S.R.L., CUI 43337078" in paragraph
        assert "J12/3784/16.11.2020" in paragraph
        assert "Cluj-Napoca" in paragraph
        assert "SMART LAND" not in paragraph
        assert "46367383" not in paragraph
        assert page["updatedLabel"] == "Actualizată la 28 septembrie 2026"
    assert before == original
    for key in before.keys() - {"siteDetails", "legalPages"}:
        assert corrected[key] == before[key]
    for key in before["legalPages"]:
        assert (
            corrected["legalPages"][key]["sections"][0]["paragraphs"][1:]
            == before["legalPages"][key]["sections"][0]["paragraphs"][1:]
        )


@pytest.mark.parametrize(
    "changed",
    [
        {"taxId": "99999999"},
        {"legalName": "Unrelated SRL"},
        {"legalName": "1A FIREARTRO EVENTS S.R.L.", "taxId": "43337078"},
    ],
)
def test_different_or_corrected_identities_remain_authoritative(changed):
    from content_migrations import migrate_company_content

    content = legacy_content()
    content["siteDetails"].update(changed)
    assert migrate_company_content(content) == content


def test_migration_is_idempotent_and_does_not_guess_vat_from_a_legacy_ro_prefix():
    from content_migrations import migrate_company_content

    content = legacy_content()
    content["siteDetails"]["taxId"] = "RO46367383"
    content["siteDetails"]["legalName"] = "1A SMART LAND SOLUTIONS S.R.L."
    for page in content["legalPages"].values():
        page["sections"][0]["paragraphs"][
            0
        ] = "CUI RO46367383 — 1A SMART LAND SOLUTIONS S.R.L."
    once = migrate_company_content(content)
    assert once["siteDetails"]["taxId"] == "43337078"
    assert migrate_company_content(once) == once
    assert "RO43337078" not in repr(once)


@pytest.mark.parametrize("tax_id", ["ro46367383", "RO  46367383", "Ro 46367383"])
def test_legacy_vat_prefix_variants_are_not_inferred_for_the_new_company(tax_id):
    from content_migrations import migrate_company_content

    content = legacy_content()
    content["siteDetails"]["taxId"] = tax_id
    content["legalPages"]["terms"]["sections"][0]["paragraphs"][0] = f"CUI {tax_id}."
    corrected = migrate_company_content(content)
    assert (
        corrected["legalPages"]["terms"]["sections"][0]["paragraphs"][0]
        == "CUI 43337078."
    )


def test_certificate_does_not_overwrite_an_unpublished_operational_address():
    from content_migrations import migrate_company_content

    content = legacy_content()
    content["siteDetails"]["mainOffice"] = "Adresa operațională editată de proprietar"
    assert (
        migrate_company_content(content)["siteDetails"]["mainOffice"]
        == content["siteDetails"]["mainOffice"]
    )


def test_certificate_replacement_keeps_the_distinct_euid_from_the_certificate():
    from content_migrations import migrate_company_content

    content = legacy_content()
    content["legalPages"]["terms"]["sections"][0]["paragraphs"].append(
        "EUID: ROONRC.J2022000693301."
    )
    corrected = migrate_company_content(content)
    terms = repr(corrected["legalPages"]["terms"])
    assert "EUID: ROONRC.J12/3784/2020." in terms
    assert "ROONRC.J12/3784/16.11.2020" not in terms


class Collection:
    """Deterministic storage double; query mismatches model Mongo CAS conflicts."""

    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))

    async def find_one(self, query, *, session=None):
        return deepcopy(
            next(
                (
                    doc
                    for doc in self.documents
                    if all(doc.get(k) == v for k, v in query.items())
                ),
                None,
            )
        )

    async def insert_one(self, document, *, session):
        if any(doc["id"] == document["id"] for doc in self.documents):
            raise RuntimeError("duplicate revision")
        self.documents.append(deepcopy(document))

    async def replace_one(self, query, replacement, *, session):
        for i, document in enumerate(self.documents):
            if all(document.get(k) == v for k, v in query.items()):
                self.documents[i] = deepcopy(replacement)
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def update_one(self, query, update, *, session):
        for document in self.documents:
            if all(document.get(k) == v for k, v in query.items()):
                document.update(deepcopy(update["$set"]))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    async def find_one_and_update(self, query, update, **options):
        existing = next(
            (
                doc
                for doc in self.documents
                if all(doc.get(k) == v for k, v in query.items())
            ),
            None,
        )
        if existing is not None:
            return deepcopy(existing)
        if options.get("upsert"):
            document = deepcopy(update["$setOnInsert"])
            self.documents.append(document)
            return deepcopy(document)
        return None


class Session:
    def __init__(self, collections):
        self.collections = collections

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def with_transaction(self, operation):
        original = [deepcopy(collection.documents) for collection in self.collections]
        try:
            return await operation(self)
        except Exception:
            for collection, documents in zip(self.collections, original):
                collection.documents = documents
            raise


class Client:
    def __init__(self, *collections):
        self.collections = collections

    async def start_session(self):
        return Session(self.collections)


def database(*, draft_base="previous", corrected_draft=False):
    public = legacy_content()
    draft = legacy_content()
    draft["homePage"]["hero"]["titleLead"] = "Unpublished owner title"
    if corrected_draft:
        draft["siteDetails"].update(
            {"legalName": "Owner-edited SRL", "taxId": "99999999"}
        )
    publications = Collection(
        [
            {
                "id": "current",
                "revision_id": "previous",
                "schema_version": 1,
                "content": public,
                "published_by": "original-owner",
            }
        ]
    )
    drafts = Collection(
        [
            {
                "id": "primary",
                "version": 7,
                "base_revision_id": draft_base,
                "schema_version": 1,
                "content": draft,
            }
        ]
    )
    revisions = Collection([{"id": "previous", "content": deepcopy(public)}])
    return Client(drafts, publications, revisions), drafts, publications, revisions


NOW = datetime(2026, 9, 28, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_atomic_revision_preserves_unpublished_edits_and_original_history():
    from content_migrations import migrate_owner_company_identity

    client, drafts, publications, revisions = database()
    old_public = deepcopy(publications.documents[0])
    old_history = deepcopy(revisions.documents[0])
    assert await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    public = publications.documents[0]
    draft = drafts.documents[0]
    assert public["content"]["siteDetails"]["taxId"] == "43337078"
    assert public["content"]["homePage"] == old_public["content"]["homePage"]
    assert draft["content"]["siteDetails"]["taxId"] == "43337078"
    assert (
        draft["content"]["homePage"]["hero"]["titleLead"] == "Unpublished owner title"
    )
    assert draft["version"] == 8
    assert draft["base_revision_id"] == public["revision_id"]
    assert public["published_at"] == NOW
    assert revisions.documents[0] == old_history
    assert revisions.documents[1]["content"] == public["content"]
    assert revisions.documents[1]["published_by"] == "owner-request"
    assert not await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    assert len(revisions.documents) == 2
    assert drafts.documents[0] == draft


@pytest.mark.asyncio
async def test_owner_draft_identity_and_older_base_are_not_overwritten():
    from content_migrations import migrate_owner_company_identity

    client, drafts, publications, revisions = database(
        draft_base="older", corrected_draft=True
    )
    original_draft = deepcopy(drafts.documents[0])
    assert await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    assert drafts.documents[0] == original_draft
    assert publications.documents[0]["content"]["siteDetails"]["taxId"] == "43337078"


@pytest.mark.asyncio
async def test_revision_marker_prevents_overriding_a_later_explicit_owner_edit():
    from content_migrations import migrate_owner_company_identity

    client, drafts, publications, revisions = database()
    await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    publications.documents[0]["content"] = legacy_content()
    publications.documents[0]["revision_id"] = "explicit-owner-restore"
    restored = deepcopy(publications.documents[0])
    assert not await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    assert publications.documents[0] == restored


@pytest.mark.asyncio
@pytest.mark.parametrize("conflict_target", ["draft", "publication"])
async def test_conflict_rolls_back_all_three_storage_documents(conflict_target):
    from content_migrations import (
        CompanyMigrationConflict,
        migrate_owner_company_identity,
    )

    client, drafts, publications, revisions = database()
    originals = [deepcopy(collection.documents) for collection in client.collections]

    async def conflict(query, replacement, *, session):
        return SimpleNamespace(matched_count=0)

    target = drafts if conflict_target == "draft" else publications
    target.replace_one = conflict
    with pytest.raises(CompanyMigrationConflict):
        await migrate_owner_company_identity(
            client, drafts, publications, revisions, now=NOW
        )
    assert [collection.documents for collection in client.collections] == originals


@pytest.mark.asyncio
async def test_missing_draft_recovery_cannot_copy_a_stale_pre_migration_publication():
    from content_migrations import migrate_owner_company_identity
    from cms_repository import MongoCmsRepository

    client, drafts, publications, revisions = database()
    drafts.documents = []
    stale_publication = deepcopy(publications.documents[0])
    await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    repository = MongoCmsRepository(
        drafts=drafts,
        publications=publications,
        revisions=revisions,
        client=client,
    )
    recovered = await repository.create_draft_from_publication(
        publication=stale_publication,
        admin_id="administrator",
        now=NOW,
    )
    assert recovered["content"]["siteDetails"]["taxId"] == "43337078"
    assert recovered["base_revision_id"] == publications.documents[0]["revision_id"]
    assert drafts.documents[0]["content"] == publications.documents[0]["content"]


@pytest.mark.asyncio
async def test_recovered_draft_envelope_reports_the_current_publication():
    from content_migrations import migrate_owner_company_identity
    from cms_repository import MongoCmsRepository
    from cms_service import CmsService

    client, drafts, publications, revisions = database()
    drafts.documents = []

    class RacingRepository(MongoCmsRepository):
        async def create_draft_from_publication(self, **kwargs):
            await migrate_owner_company_identity(
                client, drafts, publications, revisions, now=NOW
            )
            return await super().create_draft_from_publication(**kwargs)

    repository = RacingRepository(
        drafts=drafts,
        publications=publications,
        revisions=revisions,
        client=client,
    )
    recovered = await CmsService(repository).get_or_create_draft("administrator")
    assert recovered.published_revision_id == publications.documents[0]["revision_id"]
    assert recovered.published_at == NOW
    assert recovered.content.siteDetails.taxId == "43337078"


@pytest.mark.asyncio
async def test_correcting_an_older_draft_preserves_its_real_base_revision():
    from content_migrations import migrate_owner_company_identity

    client, drafts, publications, revisions = database(draft_base="older")
    await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    assert drafts.documents[0]["content"]["siteDetails"]["taxId"] == "43337078"
    assert drafts.documents[0]["base_revision_id"] == "older"


@pytest.mark.asyncio
async def test_no_publication_or_unrelated_company_is_not_bootstrapped_or_changed():
    from content_migrations import migrate_owner_company_identity

    for remove_publication in [True, False]:
        client, drafts, publications, revisions = database()
        if remove_publication:
            publications.documents = []
        else:
            publications.documents[0]["content"]["siteDetails"]["taxId"] = "99999999"
        original = [deepcopy(collection.documents) for collection in client.collections]
        assert not await migrate_owner_company_identity(
            client, drafts, publications, revisions, now=NOW
        )
        assert [collection.documents for collection in client.collections] == original


@pytest.mark.asyncio
async def test_missing_draft_is_not_replaced_by_a_new_provisional_draft():
    from content_migrations import migrate_owner_company_identity

    client, drafts, publications, revisions = database()
    drafts.documents = []
    assert await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    assert drafts.documents == []
    assert publications.documents[0]["content"]["siteDetails"]["taxId"] == "43337078"


@pytest.mark.asyncio
async def test_euid_hotfix_corrects_live_publication_and_unpublished_draft_once():
    from content_migrations import migrate_owner_company_identity, migrate_owner_euid

    client, drafts, publications, revisions = database()
    await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    malformed = "EUID: ROONRC.J12/3784/16.11.2020."
    for document in (publications.documents[0], drafts.documents[0]):
        document["content"]["legalPages"]["terms"]["sections"][0]["paragraphs"].append(
            malformed
        )
    original_hero = deepcopy(drafts.documents[0]["content"]["homePage"]["hero"])
    original_history = deepcopy(revisions.documents)
    assert await migrate_owner_euid(client, drafts, publications, revisions, now=NOW)
    for document in (publications.documents[0], drafts.documents[0]):
        terms = repr(document["content"]["legalPages"]["terms"])
        assert "EUID: ROONRC.J12/3784/2020." in terms
        assert "ROONRC.J12/3784/16.11.2020" not in terms
    assert drafts.documents[0]["content"]["homePage"]["hero"] == original_hero
    assert revisions.documents[: len(original_history)] == original_history
    assert revisions.documents[-1]["content"] == publications.documents[0]["content"]
    assert (
        drafts.documents[0]["base_revision_id"]
        == publications.documents[0]["revision_id"]
    )
    assert not await migrate_owner_euid(
        client, drafts, publications, revisions, now=NOW
    )


@pytest.mark.asyncio
async def test_euid_hotfix_does_not_change_unrelated_company_content():
    from content_migrations import migrate_owner_euid

    client, drafts, publications, revisions = database()
    publications.documents[0]["content"]["legalPages"]["terms"]["sections"][0][
        "paragraphs"
    ].append("EUID: ROONRC.J12/3784/16.11.2020.")
    original = [deepcopy(collection.documents) for collection in client.collections]
    assert not await migrate_owner_euid(
        client, drafts, publications, revisions, now=NOW
    )
    assert [collection.documents for collection in client.collections] == original


@pytest.mark.asyncio
async def test_production_startup_repairs_the_already_published_euid(monkeypatch):
    import server
    from content_migrations import migrate_owner_company_identity
    from unittest.mock import AsyncMock

    client, drafts, publications, revisions = database()
    await migrate_owner_company_identity(
        client, drafts, publications, revisions, now=NOW
    )
    for document in (publications.documents[0], drafts.documents[0]):
        document["content"]["legalPages"]["terms"]["sections"][0]["paragraphs"].append(
            "EUID: ROONRC.J12/3784/16.11.2020."
        )

    class StartupClient(Client):
        def __getitem__(self, name):
            return object()

        def close(self):
            pass

    monkeypatch.setattr(server, "client", StartupClient(*client.collections))
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            site_content_drafts=drafts,
            site_content_publications=publications,
            site_content_revisions=revisions,
        ),
    )
    monkeypatch.setattr(
        server, "AsyncIOMotorGridFSBucket", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(server, "ensure_indexes", AsyncMock())
    monkeypatch.setattr(
        server, "resend_http_client", SimpleNamespace(aclose=AsyncMock())
    )
    monkeypatch.setenv("VERCEL_ENV", "production")
    async with server.lifespan(server.app):
        assert "ROONRC.J12/3784/2020" in repr(publications.documents[0]["content"])
        assert "ROONRC.J12/3784/16.11.2020" not in repr(
            publications.documents[0]["content"]
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "environment, tax_id",
    [
        ("production", "43337078"),
        ("preview", "46367383"),
        ("development", "46367383"),
        (None, "46367383"),
    ],
)
async def test_real_app_startup_only_migrates_the_production_database(
    monkeypatch, environment, tax_id
):
    import server
    from unittest.mock import AsyncMock

    client, drafts, publications, revisions = database()

    class StartupClient(Client):
        def __getitem__(self, name):
            return object()

        def close(self):
            pass

    monkeypatch.setattr(server, "client", StartupClient(*client.collections))
    monkeypatch.setattr(
        server,
        "db",
        SimpleNamespace(
            site_content_drafts=drafts,
            site_content_publications=publications,
            site_content_revisions=revisions,
        ),
    )
    monkeypatch.setattr(
        server, "AsyncIOMotorGridFSBucket", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(server, "ensure_indexes", AsyncMock())
    monkeypatch.setattr(
        server, "resend_http_client", SimpleNamespace(aclose=AsyncMock())
    )
    if environment is None:
        monkeypatch.delenv("VERCEL_ENV", raising=False)
    else:
        monkeypatch.setenv("VERCEL_ENV", environment)
    async with server.lifespan(server.app):
        assert publications.documents[0]["content"]["siteDetails"]["taxId"] == tax_id
