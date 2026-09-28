"""Owner-approved, one-time corrections to persisted CMS content.

These are data migrations, not public-render overrides. Admin publications stay
authoritative after the immutable migration revision has been recorded.
"""

from copy import deepcopy
from datetime import datetime, timezone
import re

from cms_models import SiteContent


COMPANY_REVISION_ID = "owner-company-certificate-2026-09-28"
COMPANY_EUID_REVISION_ID = "owner-company-euid-2026-09-28"
INCORRECT_EUID = "ROONRC.J12/3784/16.11.2020"
CERTIFICATE_EUID = "ROONRC.J12/3784/2020"
COMPANY_DETAILS = {
    "legalName": "1A FIREARTRO EVENTS S.R.L.",
    "taxId": "43337078",
    "registrationNumber": "J12/3784/16.11.2020",
    "registeredOffice": (
        "Strada Oltului nr. 1, camera nr. 1, et. 1, ap. 4, "
        "Cluj-Napoca, județul Cluj, România"
    ),
    # The certificate establishes a registered office, not a second location
    # where customers are received. Neither capital nor VAT is established.
    "secondaryOffice": "",
}


class CompanyMigrationConflict(Exception):
    """A concurrent CMS edit prevents the exact observed migration."""


def migrate_company_content(content):
    """Correct only the known previous entity, preserving every other section."""
    previous = content["siteDetails"]
    name = re.sub(r"[^A-Z0-9]", "", previous["legalName"].upper())
    tax_id = re.sub(r"^RO\s*", "", previous["taxId"].strip().upper())
    if name != "1ASMARTLANDSOLUTIONSSRL" or tax_id != "46367383":
        return content

    corrected = deepcopy(content)
    corrected["siteDetails"].update(COMPANY_DETAILS)
    corrected["siteDetails"].pop("shareCapital", None)

    replacements = [
        ("1A SMART LAND SOLUTIONS S.R.L.", COMPANY_DETAILS["legalName"]),
        ("1A SMART LAND SOLUTIONS SRL", COMPANY_DETAILS["legalName"]),
        (previous["legalName"], COMPANY_DETAILS["legalName"]),
        (previous["registrationNumber"], COMPANY_DETAILS["registrationNumber"]),
        (previous["registeredOffice"], COMPANY_DETAILS["registeredOffice"]),
    ]
    for document in corrected["legalPages"].values():
        for section in document["sections"]:
            paragraphs = []
            for paragraph in section["paragraphs"]:
                paragraph = re.sub(
                    r"\b(?:RO\s*)?46367383\b",
                    COMPANY_DETAILS["taxId"],
                    paragraph,
                    flags=re.IGNORECASE,
                )
                for old, new in replacements:
                    if old:
                        paragraph = paragraph.replace(old, new)
                paragraph = paragraph.replace(INCORRECT_EUID, CERTIFICATE_EUID)
                paragraphs.append(paragraph)
            section["paragraphs"] = paragraphs
        document["updatedLabel"] = "Actualizată la 28 septembrie 2026"
    # Validate without canonicalizing unrelated owner fields or adding defaults.
    SiteContent.model_validate(corrected)
    return corrected


def correct_certificate_euid(content):
    """Repair only the EUID typo introduced by the first live migration."""
    details = content["siteDetails"]
    if (
        details["legalName"] != COMPANY_DETAILS["legalName"]
        or details["taxId"] != COMPANY_DETAILS["taxId"]
    ):
        return content
    corrected = deepcopy(content)
    changed = False
    for document in corrected["legalPages"].values():
        for section in document["sections"]:
            paragraphs = []
            for paragraph in section["paragraphs"]:
                repaired = paragraph.replace(INCORRECT_EUID, CERTIFICATE_EUID)
                changed |= repaired != paragraph
                paragraphs.append(repaired)
            section["paragraphs"] = paragraphs
    if not changed:
        return content
    SiteContent.model_validate(corrected)
    return corrected


async def migrate_owner_company_identity(
    client, drafts, publications, revisions, *, now=None
):
    """Persist the public correction, its history, and an independent draft atomically."""
    now = now or datetime.now(timezone.utc)

    async def transaction(session):
        if await revisions.find_one({"id": COMPANY_REVISION_ID}, session=session):
            return False
        current = await publications.find_one({"id": "current"}, session=session)
        if current is None:
            return False
        corrected = migrate_company_content(current["content"])
        if corrected == current["content"]:
            return False

        previous_revision = current["revision_id"]
        revision = {
            "id": COMPANY_REVISION_ID,
            "schema_version": current["schema_version"],
            "content": corrected,
            "summary": "Date firmă corectate conform certificatului furnizat de proprietar",
            "published_at": now,
            "published_by": "owner-request",
        }
        publication = {
            **current,
            "content": corrected,
            "revision_id": COMPANY_REVISION_ID,
            "published_at": now,
            "published_by": "owner-request",
        }
        # Never promote unrelated, unpublished draft edits to the public site.
        draft = await drafts.find_one({"id": "primary"}, session=session)
        if draft is not None:
            corrected_draft = migrate_company_content(draft["content"])
            if corrected_draft != draft["content"]:
                updated_draft = {
                    **draft,
                    "content": corrected_draft,
                    "version": draft["version"] + 1,
                    "updated_at": now,
                    "updated_by": "owner-request",
                }
                if draft.get("base_revision_id") == previous_revision:
                    updated_draft["base_revision_id"] = COMPANY_REVISION_ID
                saved = await drafts.replace_one(
                    {"id": "primary", "version": draft["version"]},
                    updated_draft,
                    session=session,
                )
                if saved.matched_count != 1:
                    raise CompanyMigrationConflict()

        await revisions.insert_one(revision, session=session)
        saved = await publications.replace_one(
            {"id": "current", "revision_id": previous_revision},
            publication,
            session=session,
        )
        if saved.matched_count != 1:
            raise CompanyMigrationConflict()
        return True

    async with await client.start_session() as session:
        return await session.with_transaction(transaction)


async def migrate_owner_euid(client, drafts, publications, revisions, *, now=None):
    """Publish the certificate's exact EUID, retaining CMS history and draft edits."""
    now = now or datetime.now(timezone.utc)

    async def transaction(session):
        if await revisions.find_one({"id": COMPANY_EUID_REVISION_ID}, session=session):
            return False
        current = await publications.find_one({"id": "current"}, session=session)
        if current is None:
            return False
        corrected = correct_certificate_euid(current["content"])
        if corrected == current["content"]:
            return False

        previous_revision = current["revision_id"]
        draft = await drafts.find_one({"id": "primary"}, session=session)
        if draft is not None:
            corrected_draft = correct_certificate_euid(draft["content"])
            if corrected_draft != draft["content"]:
                updated_draft = {
                    **draft,
                    "content": corrected_draft,
                    "version": draft["version"] + 1,
                    "updated_at": now,
                    "updated_by": "owner-request",
                }
                if draft.get("base_revision_id") == previous_revision:
                    updated_draft["base_revision_id"] = COMPANY_EUID_REVISION_ID
                saved = await drafts.replace_one(
                    {"id": "primary", "version": draft["version"]},
                    updated_draft,
                    session=session,
                )
                if saved.matched_count != 1:
                    raise CompanyMigrationConflict()

        revision = {
            "id": COMPANY_EUID_REVISION_ID,
            "schema_version": current["schema_version"],
            "content": corrected,
            "summary": "EUID corectat conform certificatului furnizat de proprietar",
            "published_at": now,
            "published_by": "owner-request",
        }
        await revisions.insert_one(revision, session=session)
        publication = {
            **current,
            "content": corrected,
            "revision_id": COMPANY_EUID_REVISION_ID,
            "published_at": now,
            "published_by": "owner-request",
        }
        saved = await publications.replace_one(
            {"id": "current", "revision_id": previous_revision},
            publication,
            session=session,
        )
        if saved.matched_count != 1:
            raise CompanyMigrationConflict()
        return True

    async with await client.start_session() as session:
        return await session.with_transaction(transaction)
