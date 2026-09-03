"""Strict, versioned content contract for the FireArtRo CMS.

The models deliberately accept plain text and safe links only. Presentation,
scripts, credentials, arbitrary HTML, and CSS remain code-owned.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,79}$"
PHONE_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
WHATSAPP_PATTERN = re.compile(r"^[1-9]\d{7,14}$")

MEDIA_CATEGORIES = (
    "Artificii de zi",
    "Artificii de noapte",
    "Drone show",
    "Drone + artificii",
    "Efecte speciale",
    "Corporate / Festival",
    "Festival",
    "Nuntă",
    "Corporate",
    "Promoții",
)
PACKAGE_CATEGORIES = (
    "Artificii de zi",
    "Artificii de noapte",
    "Show drone",
    "Drone + artificii",
    "Efecte speciale",
    "Corporate / Festival",
)


class StrictModel(BaseModel):
    """A plain JSON-only model: unknown fields must never silently publish."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True,
        serialize_by_alias=True,
    )


def _safe_web_url(value: str, *, allow_empty: bool = False) -> str:
    normalized = str(value or "").strip()
    if not normalized and allow_empty:
        return ""
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Linkul trebuie să fie http sau https.")
    return normalized


def _safe_content_href(value: str, *, allow_empty: bool = False) -> str:
    normalized = str(value or "").strip()
    if not normalized and allow_empty:
        return ""
    if any(character in normalized for character in ("\r", "\n", "\\")):
        raise ValueError("Destinația linkului nu este validă.")
    if normalized.startswith("/") and not normalized.startswith("//"):
        return normalized
    if normalized.startswith("#"):
        return normalized
    if normalized.startswith("mailto:"):
        email = normalized.removeprefix("mailto:").strip()
        if email and "@" in email and "\n" not in email and "\r" not in email:
            return f"mailto:{email}"
    if normalized.startswith("tel:"):
        number = _normalize_phone(normalized.removeprefix("tel:"))
        return f"tel:{number}"
    return _safe_web_url(normalized)


def _normalize_phone(value: str) -> str:
    raw = str(value or "").strip()
    compact = re.sub(r"[\s().-]+", "", raw)
    if compact.startswith("00"):
        compact = f"+{compact[2:]}"
    elif compact and not compact.startswith("+"):
        compact = f"+{compact}"
    if not PHONE_PATTERN.fullmatch(compact):
        raise ValueError("Numărul de telefon trebuie să fie internațional.")
    return compact


def _normalize_whatsapp(value: str) -> str:
    phone = _normalize_phone(value)
    digits = phone.removeprefix("+")
    if not WHATSAPP_PATTERN.fullmatch(digits):
        raise ValueError("Numărul WhatsApp nu este valid.")
    return digits


def _plain_text(value: str) -> str:
    normalized = str(value or "").strip()
    if "<" in normalized or ">" in normalized:
        raise ValueError("HTML-ul nu este permis în conținutul juridic.")
    return normalized


def _assert_unique_ids(items: list[object], label: str) -> None:
    ids = [getattr(item, "id") for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{label} trebuie să aibă identificatori unici.")


class SiteDetails(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    siteUrl: str = Field(min_length=8, max_length=500)
    email: EmailStr
    googleReviewsUrl: str = Field(default="", max_length=500)
    areaServed: str = Field(min_length=1, max_length=160)
    legalName: str = Field(min_length=1, max_length=180)
    registrationNumber: str = Field(min_length=1, max_length=80)
    taxId: str = Field(min_length=1, max_length=80)
    registeredOffice: str = Field(min_length=1, max_length=500)
    mainOffice: str = Field(default="", max_length=500)
    secondaryOffice: str = Field(default="", max_length=500)
    seoTitle: str = Field(default="", max_length=160)
    seoDescription: str = Field(default="", max_length=320)

    @field_validator("siteUrl")
    @classmethod
    def validate_site_url(cls, value: str) -> str:
        return _safe_web_url(value)

    @field_validator("googleReviewsUrl")
    @classmethod
    def validate_reviews_url(cls, value: str) -> str:
        return _safe_web_url(value, allow_empty=True)


class ContactSettings(StrictModel):
    phoneDisplay: str = Field(min_length=3, max_length=40)
    phoneTel: str = Field(min_length=8, max_length=20)
    whatsappNumber: str = Field(min_length=8, max_length=20)

    @field_validator("phoneTel")
    @classmethod
    def normalize_phone_tel(cls, value: str) -> str:
        return _normalize_phone(value)

    @field_validator("whatsappNumber")
    @classmethod
    def normalize_whatsapp_number(cls, value: str) -> str:
        return _normalize_whatsapp(value)


class BusinessHours(StrictModel):
    label: str = Field(min_length=1, max_length=160)
    note: str = Field(default="", max_length=1000)
    schema_: list[str] = Field(alias="schema", serialization_alias="schema", min_length=1, max_length=7)

    @field_validator("schema_")
    @classmethod
    def validate_schema_rows(cls, values: list[str]) -> list[str]:
        if any(not value or len(value) > 80 for value in values):
            raise ValueError("Programul trebuie să conțină intervale valide.")
        return values


class LinkItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    label: str = Field(min_length=1, max_length=100)
    href: str = Field(min_length=1, max_length=500)

    @field_validator("href")
    @classmethod
    def validate_href(cls, value: str) -> str:
        return _safe_content_href(value)


class SocialLink(LinkItem):
    placeholder: bool = False

    @field_validator("href")
    @classmethod
    def validate_social_href(cls, value: str) -> str:
        return _safe_web_url(value)


class NavigationContent(StrictModel):
    links: list[LinkItem] = Field(min_length=1, max_length=12)


class FooterContent(StrictModel):
    tagline: str = Field(min_length=1, max_length=280)
    exploreHeading: str = Field(min_length=1, max_length=80)
    contactHeading: str = Field(min_length=1, max_length=80)
    socialHeading: str = Field(min_length=1, max_length=80)
    copyright: str = Field(min_length=1, max_length=120)
    exploreLinks: list[LinkItem] = Field(min_length=1, max_length=12)
    legalLinks: list[LinkItem] = Field(min_length=1, max_length=8)


class SectionCopy(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=1200)
    ctaLabel: str = Field(default="", max_length=80)
    ctaHref: str = Field(default="", max_length=500)

    @field_validator("ctaHref")
    @classmethod
    def validate_cta_href(cls, value: str) -> str:
        return _safe_content_href(value, allow_empty=True)

    @model_validator(mode="after")
    def require_complete_cta(self):
        if bool(self.ctaLabel) != bool(self.ctaHref):
            raise ValueError("Un CTA are nevoie de text și destinație.")
        return self


class RichSection(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    body: list[str] = Field(min_length=1, max_length=12)

    @field_validator("body")
    @classmethod
    def validate_body(cls, values: list[str]) -> list[str]:
        if any(not value or len(value) > 2000 for value in values):
            raise ValueError("Paragrafele trebuie să aibă conținut valid.")
        return values


class HeroContent(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=100)
    titleLead: str = Field(min_length=1, max_length=100)
    titleTail: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=600)
    primaryCtaLabel: str = Field(min_length=1, max_length=80)
    primaryCtaHref: str = Field(min_length=1, max_length=500)
    secondaryCtaLabel: str = Field(min_length=1, max_length=80)
    secondaryCtaHref: str = Field(min_length=1, max_length=500)
    backgroundMediaId: str = Field(default="", max_length=80, pattern=rf"^$|{ID_PATTERN}")

    @field_validator("primaryCtaHref", "secondaryCtaHref")
    @classmethod
    def validate_hero_href(cls, value: str) -> str:
        return _safe_content_href(value)


class PromoSlide(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    type: Literal["image", "video", "youtube", "promotion"]
    title: str = Field(min_length=1, max_length=180)
    shortText: str = Field(min_length=1, max_length=600)
    badge: str = Field(default="", max_length=80)
    mediaId: str = Field(default="", max_length=80, pattern=rf"^$|{ID_PATTERN}")
    youtubeUrl: str = Field(default="", max_length=500)
    ctaLabel: str = Field(min_length=1, max_length=80)
    ctaHref: str = Field(min_length=1, max_length=500)

    @field_validator("youtubeUrl")
    @classmethod
    def validate_youtube_url(cls, value: str) -> str:
        return _safe_web_url(value, allow_empty=True)

    @field_validator("ctaHref")
    @classmethod
    def validate_slide_href(cls, value: str) -> str:
        return _safe_content_href(value)

    @model_validator(mode="after")
    def require_media_for_slide_type(self):
        if self.type == "youtube" and not self.youtubeUrl:
            raise ValueError("Un slide YouTube are nevoie de URL.")
        if self.type != "youtube" and not self.mediaId:
            raise ValueError("Slide-ul are nevoie de media asociată.")
        return self


class HomePageContent(StrictModel):
    hero: HeroContent
    gallery: SectionCopy
    packages: SectionCopy
    about: RichSection
    partners: SectionCopy
    brief: SectionCopy
    promoSlides: list[PromoSlide] = Field(default_factory=list, max_length=12)


class InteriorPageContent(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=1200)
    seoTitle: str = Field(min_length=1, max_length=160)
    seoDescription: str = Field(min_length=1, max_length=320)
    heroMediaId: str = Field(default="", max_length=80, pattern=rf"^$|{ID_PATTERN}")


class ContactOption(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    label: str = Field(min_length=1, max_length=120)


class ContactPageContent(StrictModel):
    eyebrow: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=1200)
    formTitle: str = Field(min_length=1, max_length=120)
    eventTypes: list[ContactOption] = Field(min_length=1, max_length=24)
    showOptions: list[ContactOption] = Field(min_length=1, max_length=24)
    consentLabel: str = Field(min_length=1, max_length=400)
    submitLabel: str = Field(min_length=1, max_length=80)


class MediaItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    type: Literal["image", "video", "youtube", "promo"]
    title: str = Field(min_length=1, max_length=160)
    shortDescription: str = Field(min_length=1, max_length=1000)
    category: Literal[
        "Artificii de zi", "Artificii de noapte", "Drone show", "Drone + artificii",
        "Efecte speciale", "Corporate / Festival", "Festival", "Nuntă", "Corporate", "Promoții",
    ]
    tags: list[str] = Field(default_factory=list, max_length=24)
    thumbnail: str = Field(default="", max_length=500)
    poster: str = Field(default="", max_length=500)
    src: str = Field(default="", max_length=500)
    youtubeUrl: str = Field(default="", max_length=500)
    alt: str = Field(min_length=3, max_length=400)
    featured: bool = False
    date: str = Field(min_length=10, max_length=10)
    order: int = Field(ge=0, le=100_000)
    eventType: str = Field(default="", max_length=120)
    ctaLabel: str = Field(default="", max_length=80)
    ctaHref: str = Field(default="", max_length=500)
    width: int | None = Field(default=None, ge=1, le=32_000)
    height: int | None = Field(default=None, ge=1, le=32_000)
    aspectRatio: float | None = Field(default=None, gt=0, le=100)

    @field_validator("thumbnail", "poster", "src")
    @classmethod
    def validate_media_path(cls, value: str) -> str:
        return _safe_content_href(value, allow_empty=True)

    @field_validator("youtubeUrl")
    @classmethod
    def validate_media_youtube_url(cls, value: str) -> str:
        return _safe_web_url(value, allow_empty=True)

    @field_validator("ctaHref")
    @classmethod
    def validate_media_cta_href(cls, value: str) -> str:
        return _safe_content_href(value, allow_empty=True)

    @field_validator("date")
    @classmethod
    def validate_media_date(cls, value: str) -> str:
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Data media nu este validă.") from exc
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        if any(not value or len(value) > 80 for value in values):
            raise ValueError("Etichetele media nu sunt valide.")
        return values

    @model_validator(mode="after")
    def require_media_source(self):
        if self.type == "youtube" and not self.youtubeUrl:
            raise ValueError("Media YouTube are nevoie de URL.")
        if self.type in {"image", "video", "promo"} and not self.src:
            raise ValueError("Media are nevoie de sursă.")
        if bool(self.ctaLabel) != bool(self.ctaHref):
            raise ValueError("Un CTA media are nevoie de text și destinație.")
        return self


class PackageItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    title: str = Field(min_length=1, max_length=160)
    category: Literal[
        "Artificii de zi", "Artificii de noapte", "Show drone", "Drone + artificii",
        "Efecte speciale", "Corporate / Festival",
    ]
    bestFor: str = Field(default="", max_length=400)
    shortDescription: str = Field(min_length=1, max_length=1200)
    visualImpact: str = Field(default="", max_length=240)
    duration: str = Field(default="", max_length=120)
    droneCount: int | None = Field(default=None, ge=0, le=100_000)
    effectsCount: int | None = Field(default=None, ge=0, le=100_000)
    badge: str = Field(default="", max_length=120)
    cta: str = Field(min_length=1, max_length=80)
    ctaHref: str = Field(min_length=1, max_length=500)
    imageMediaId: str = Field(default="", max_length=80, pattern=rf"^$|{ID_PATTERN}")
    highlights: list[str] = Field(default_factory=list, max_length=24)
    bonus: str = Field(default="", max_length=1200)
    videoUrl: str = Field(default="", max_length=500)
    videoNote: str = Field(default="", max_length=500)
    moreVideoUrls: list[str] = Field(default_factory=list, max_length=24)

    @field_validator("ctaHref")
    @classmethod
    def validate_package_cta_href(cls, value: str) -> str:
        return _safe_content_href(value)

    @field_validator("videoUrl")
    @classmethod
    def validate_package_video_url(cls, value: str) -> str:
        return _safe_web_url(value, allow_empty=True)

    @field_validator("moreVideoUrls")
    @classmethod
    def validate_more_videos(cls, values: list[str]) -> list[str]:
        return [_safe_web_url(value) for value in values]

    @field_validator("highlights")
    @classmethod
    def validate_highlights(cls, values: list[str]) -> list[str]:
        if any(not value or len(value) > 240 for value in values):
            raise ValueError("Caracteristicile pachetului nu sunt valide.")
        return values


class FaqItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    q: str = Field(min_length=3, max_length=240)
    a: str = Field(min_length=3, max_length=4000)


class TestimonialItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    name: str = Field(min_length=1, max_length=120)
    eventType: str = Field(default="", max_length=120)
    quote: str = Field(min_length=3, max_length=2000)
    source: Literal["client", "google", "facebook", "other"] = "client"
    replaceable: bool = False


class PartnerItem(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    name: str = Field(min_length=1, max_length=120)
    logoPlaceholder: str = Field(default="", max_length=120)
    logoMediaId: str = Field(default="", max_length=80, pattern=rf"^$|{ID_PATTERN}")
    replaceable: bool = False


class ReviewSettings(StrictModel):
    enabled: bool = False
    heading: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=600)
    googleEnabled: bool = False
    facebookEnabled: bool = False
    maxItems: int = Field(default=8, ge=1, le=20)


class CookieSettings(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=1200)
    necessaryLabel: str = Field(min_length=1, max_length=120)
    necessaryDescription: str = Field(min_length=1, max_length=1200)
    analyticsLabel: str = Field(min_length=1, max_length=120)
    analyticsDescription: str = Field(min_length=1, max_length=1200)
    marketingLabel: str = Field(min_length=1, max_length=120)
    marketingDescription: str = Field(min_length=1, max_length=1200)
    retentionDays: int = Field(ge=1, le=730)


class LegalSection(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=ID_PATTERN)
    heading: str = Field(min_length=1, max_length=200)
    paragraphs: list[str] = Field(min_length=1, max_length=30)

    @field_validator("heading")
    @classmethod
    def validate_legal_heading(cls, value: str) -> str:
        return _plain_text(value)

    @field_validator("paragraphs")
    @classmethod
    def validate_legal_paragraphs(cls, values: list[str]) -> list[str]:
        normalized = [_plain_text(value) for value in values]
        if any(not value or len(value) > 5000 for value in normalized):
            raise ValueError("Paragrafele juridice trebuie să fie text simplu valid.")
        return normalized


class LegalDocument(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    updatedLabel: str = Field(min_length=1, max_length=160)
    sections: list[LegalSection] = Field(min_length=1, max_length=30)

    @field_validator("title", "updatedLabel")
    @classmethod
    def validate_legal_text(cls, value: str) -> str:
        return _plain_text(value)


class LegalPages(StrictModel):
    privacy: LegalDocument
    terms: LegalDocument
    cookies: LegalDocument


class SiteContent(StrictModel):
    schema_version: Literal[1] = 1
    siteDetails: SiteDetails
    contactSettings: ContactSettings
    businessHours: BusinessHours
    socialLinks: list[SocialLink] = Field(min_length=1, max_length=12)
    navigation: NavigationContent
    footer: FooterContent
    homePage: HomePageContent
    galleryPage: InteriorPageContent
    packagesPage: InteriorPageContent
    faqPage: InteriorPageContent
    contactPage: ContactPageContent
    blogPage: InteriorPageContent
    mediaItems: list[MediaItem] = Field(max_length=2_000)
    packages: list[PackageItem] = Field(max_length=200)
    faqs: list[FaqItem] = Field(max_length=100)
    testimonials: list[TestimonialItem] = Field(max_length=100)
    partners: list[PartnerItem] = Field(max_length=100)
    reviewSettings: ReviewSettings
    cookieSettings: CookieSettings
    legalPages: LegalPages

    @model_validator(mode="after")
    def enforce_snapshot_integrity(self):
        _assert_unique_ids(self.socialLinks, "socialLinks")
        _assert_unique_ids(self.navigation.links, "navigation.links")
        _assert_unique_ids(self.footer.exploreLinks, "footer.exploreLinks")
        _assert_unique_ids(self.footer.legalLinks, "footer.legalLinks")
        _assert_unique_ids(self.homePage.promoSlides, "homePage.promoSlides")
        _assert_unique_ids(self.contactPage.eventTypes, "contactPage.eventTypes")
        _assert_unique_ids(self.contactPage.showOptions, "contactPage.showOptions")
        _assert_unique_ids(self.mediaItems, "mediaItems")
        _assert_unique_ids(self.packages, "packages")
        _assert_unique_ids(self.faqs, "faqs")
        _assert_unique_ids(self.testimonials, "testimonials")
        _assert_unique_ids(self.partners, "partners")
        _assert_unique_ids(self.legalPages.privacy.sections, "legalPages.privacy.sections")
        _assert_unique_ids(self.legalPages.terms.sections, "legalPages.terms.sections")
        _assert_unique_ids(self.legalPages.cookies.sections, "legalPages.cookies.sections")

        media_ids = {item.id for item in self.mediaItems}
        references = [
            self.homePage.hero.backgroundMediaId,
            self.galleryPage.heroMediaId,
            self.packagesPage.heroMediaId,
            self.faqPage.heroMediaId,
            self.blogPage.heroMediaId,
            *(slide.mediaId for slide in self.homePage.promoSlides),
            *(package.imageMediaId for package in self.packages),
            *(partner.logoMediaId for partner in self.partners),
        ]
        for media_id in references:
            if media_id and media_id not in media_ids:
                raise ValueError(f"Referința media '{media_id}' nu există în mediaItems.")
        return self


class DraftUpdate(StrictModel):
    version: int = Field(ge=0)
    content: SiteContent


class DraftResponse(StrictModel):
    version: int = Field(ge=0)
    base_revision_id: str | None = Field(default=None, max_length=80)
    published_revision_id: str | None = Field(default=None, max_length=80)
    published_at: datetime | None = None
    content: SiteContent
    updated_at: datetime
    updated_by: str = Field(min_length=1, max_length=80)


class PublishRequest(StrictModel):
    version: int = Field(ge=0)
    summary: str = Field(default="", max_length=240)

    @field_validator("summary")
    @classmethod
    def validate_summary(cls, value: str) -> str:
        return _plain_text(value)


class RestoreRequest(StrictModel):
    """The editor's current draft version required to restore a revision safely."""

    version: int = Field(ge=0)


class PublicationResponse(StrictModel):
    revision_id: str = Field(min_length=1, max_length=80)
    published_at: datetime
    content: SiteContent


class RevisionSummary(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    summary: str = Field(default="", max_length=240)
    published_at: datetime
    published_by: str = Field(min_length=1, max_length=80)


class RevisionResponse(RevisionSummary):
    content: SiteContent


class PublishResponse(StrictModel):
    publication: PublicationResponse
    draft: DraftResponse
    revision: RevisionResponse
