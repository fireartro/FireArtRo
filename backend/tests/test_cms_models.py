"""Contract tests for the versioned FireArtRo managed-content payload."""

from copy import deepcopy
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from cms_models import (
    DraftResponse,
    DraftUpdate,
    PublicationResponse,
    PublishRequest,
    RestoreRequest,
    RevisionResponse,
    RevisionSummary,
    SiteContent,
)


@pytest.fixture
def default_content():
    """A complete, small v1 snapshot independent from the frontend fallback."""
    return {
        "schema_version": 1,
        "siteDetails": {
            "name": "FireArtRo",
            "siteUrl": "https://www.fireartro.ro",
            "email": "contact@fireart.ro",
            "googleReviewsUrl": "https://maps.google.com/?cid=1",
            "areaServed": "România",
            "legalName": "FireArtRo Events SRL",
            "registrationNumber": "J12/123/2026",
            "taxId": "RO12345678",
            "registeredOffice": "Cluj-Napoca",
            "mainOffice": "Cluj-Napoca",
            "secondaryOffice": "",
            "seoTitle": "FireArtRo | Spectacole",
            "seoDescription": "Spectacole cu drone, artificii și efecte scenice.",
        },
        "contactSettings": {
            "phoneDisplay": "+40 787 602 144",
            "phoneTel": "+40 (787) 602-144",
            "whatsappNumber": "+40 787 602 144",
        },
        "businessHours": {
            "label": "Luni–Vineri, 10:00–18:00",
            "note": "Disponibilitatea se confirmă după brief.",
            "schema": ["Mo-Fr 10:00-18:00"],
        },
        "socialLinks": [
            {"id": "youtube", "label": "YouTube", "href": "https://youtube.com/@fireart", "placeholder": False},
        ],
        "navigation": {
            "links": [
                {"id": "about", "label": "Despre noi", "href": "#intro"},
                {"id": "contact", "label": "Contact", "href": "/contact"},
            ],
        },
        "footer": {
            "tagline": "Spectacole construite pentru momentul potrivit.",
            "exploreHeading": "Explorează",
            "contactHeading": "Contact direct",
            "socialHeading": "Urmărește",
            "copyright": "© 2026 FireArtRo",
            "exploreLinks": [
                {"id": "packages", "label": "Pachete", "href": "/pachete"},
            ],
            "legalLinks": [
                {"id": "privacy", "label": "Confidențialitate", "href": "/confidentialitate"},
            ],
        },
        "homePage": {
            "hero": {
                "eyebrow": "DRONE · ARTIFICII · EFECTE SCENICE",
                "titleLead": "Spectacole",
                "titleTail": "în lumină.",
                "description": "Momente care rămân.",
                "primaryCtaLabel": "Cere ofertă",
                "primaryCtaHref": "/contact",
                "secondaryCtaLabel": "Vezi galeria",
                "secondaryCtaHref": "/galerie",
                "backgroundMediaId": "media-hero",
            },
            "gallery": {"eyebrow": "Selecție FireArtRo", "title": "Momente în mișcare.", "description": "Cadre reale.", "ctaLabel": "Vezi galeria", "ctaHref": "/galerie"},
            "packages": {"eyebrow": "Pachete FireArtRo", "title": "Fiecare noapte cere alt spectacol.", "description": "Alege direcția potrivită.", "ctaLabel": "Vezi pachetele", "ctaHref": "/pachete"},
            "about": {"eyebrow": "Despre FireArtRo", "title": "Construim spectacolul împreună.", "body": ["Planificăm fiecare detaliu."]},
            "partners": {"eyebrow": "Împreună în producție", "title": "Parteneriate care duc ideea până la capăt.", "description": "Echipele intră în aceeași orbită."},
            "brief": {"eyebrow": "Începem cu reperele", "title": "Spune-ne ce pregătești.", "description": "Construim direcția potrivită.", "ctaLabel": "Cere ofertă", "ctaHref": "/contact"},
            "promoSlides": [
                {"id": "slide-hero", "type": "image", "title": "Un moment în lumină", "shortText": "Un cadru FireArtRo.", "badge": "Selecție", "mediaId": "media-hero", "ctaLabel": "Vezi galeria", "ctaHref": "/galerie"},
            ],
        },
        "galleryPage": {"eyebrow": "Galerie FireArtRo", "title": "Galerie", "description": "Cadre reale din spectacole.", "seoTitle": "Galerie FireArtRo", "seoDescription": "Galerie spectacole.", "heroMediaId": "media-hero"},
        "packagesPage": {"eyebrow": "Formate FireArtRo", "title": "Pachete", "description": "Alege direcția potrivită.", "seoTitle": "Pachete FireArtRo", "seoDescription": "Pachete de spectacol.", "heroMediaId": "media-hero"},
        "faqPage": {"eyebrow": "Întrebări", "title": "Întrebări.", "description": "Ce contează înainte de rezervare.", "seoTitle": "Întrebări FireArtRo", "seoDescription": "Întrebări frecvente.", "heroMediaId": "media-hero"},
        "contactPage": {
            "eyebrow": "Brief FireArtRo",
            "title": "Ai data. Construim restul.",
            "description": "Spune-ne reperele evenimentului.",
            "formTitle": "Planificare eveniment",
            "eventTypes": [{"id": "wedding", "label": "Nuntă"}],
            "showOptions": [{"id": "drone-show", "label": "Spectacol cu drone"}],
            "consentLabel": "Sunt de acord cu politica de confidențialitate.",
            "submitLabel": "Trimite cererea",
        },
        "blogPage": {"eyebrow": "Jurnal FireArtRo", "title": "Blog", "description": "Articole publicate de echipa FireArtRo.", "seoTitle": "Blog FireArtRo", "seoDescription": "Jurnalul FireArtRo.", "heroMediaId": "media-hero"},
        "mediaItems": [
            {
                "id": "media-hero",
                "type": "image",
                "title": "Cer în mișcare",
                "shortDescription": "O coregrafie luminoasă.",
                "category": "Drone show",
                "tags": ["Drone show"],
                "thumbnail": "/media/hero.webp",
                "poster": "/media/hero.webp",
                "src": "/media/hero.webp",
                "youtubeUrl": "",
                "alt": "Dronă luminoasă pe cer.",
                "featured": True,
                "date": "2026-09-03",
                "order": 1,
                "eventType": "Corporate",
                "ctaLabel": "Vezi detalii",
                "ctaHref": "/contact",
                "width": 1920,
                "height": 1080,
                "aspectRatio": 1.7778,
            },
        ],
        "packages": [
            {
                "id": "night-gold",
                "title": "Gold",
                "category": "Artificii de noapte",
                "bestFor": "Evenimente private",
                "shortDescription": "Final pirotehnic regizat.",
                "visualImpact": "Amplu",
                "duration": "2–4 minute",
                "droneCount": None,
                "effectsCount": None,
                "badge": "Premium",
                "cta": "Cere ofertă",
                "ctaHref": "/contact",
                "imageMediaId": "media-hero",
                "highlights": ["Calibru mare"],
                "bonus": "Configurație adaptată.",
                "videoUrl": "https://www.youtube.com/watch?v=example",
                "videoNote": "Film de referință.",
                "moreVideoUrls": [],
            },
        ],
        "faqs": [{"id": "booking", "q": "Cu cât timp înainte trebuie rezervat?", "a": "Recomandăm să ne contactezi din timp pentru planificare."}],
        "testimonials": [{"id": "client-one", "name": "Client aprobat", "eventType": "Corporate", "quote": "Un moment excelent pentru invitați.", "source": "client", "replaceable": False}],
        "partners": [{"id": "partner-one", "name": "Partener aprobat", "logoPlaceholder": "PARTENER", "logoMediaId": "media-hero", "replaceable": False}],
        "reviewSettings": {"enabled": True, "heading": "Recenzii", "description": "Experiențe verificate.", "googleEnabled": True, "facebookEnabled": True, "maxItems": 8},
        "cookieSettings": {
            "title": "Preferințe cookies",
            "summary": "Folosim cookies necesare și opționale.",
            "necessaryLabel": "Strict necesare",
            "necessaryDescription": "Sunt necesare funcționării site-ului.",
            "analyticsLabel": "Analiză",
            "analyticsDescription": "Ne ajută să înțelegem folosirea site-ului.",
            "marketingLabel": "Marketing",
            "marketingDescription": "Ajută la relevanța comunicării.",
            "retentionDays": 180,
        },
        "legalPages": {
            "privacy": {"title": "Politica de confidențialitate", "updatedLabel": "Actualizată la 3 septembrie 2026", "sections": [{"id": "privacy-data", "heading": "Date personale", "paragraphs": ["Prelucrăm datele doar pentru solicitarea ta."]}]},
            "terms": {"title": "Termeni și condiții", "updatedLabel": "Actualizată la 3 septembrie 2026", "sections": [{"id": "terms-use", "heading": "Utilizare", "paragraphs": ["Conținutul site-ului este protejat."]}]},
            "cookies": {"title": "Politica de cookies", "updatedLabel": "Actualizată la 3 septembrie 2026", "sections": [{"id": "cookies-use", "heading": "Cookies", "paragraphs": ["Poți alege preferințele tale."]}]},
        },
    }


def test_site_content_accepts_a_complete_v1_snapshot(default_content):
    content = SiteContent.model_validate(default_content)
    assert content.schema_version == 1
    assert content.contactSettings.phoneTel == "+40787602144"
    assert content.contactSettings.whatsappNumber == "40787602144"
    assert content.model_dump(mode="json")["businessHours"]["schema"] == ["Mo-Fr 10:00-18:00"]


def test_site_content_rejects_duplicate_package_ids(default_content):
    default_content["packages"].append(deepcopy(default_content["packages"][0]))
    with pytest.raises(ValidationError, match="packages.*identificatori unici"):
        SiteContent.model_validate(default_content)


def test_site_content_rejects_javascript_links(default_content):
    default_content["socialLinks"][0]["href"] = "javascript:alert(1)"
    with pytest.raises(ValidationError, match="http"):
        SiteContent.model_validate(default_content)

    default_content = deepcopy(default_content)
    default_content["socialLinks"][0]["href"] = "https://youtube.com/@fireart"
    default_content["homePage"]["hero"]["primaryCtaHref"] = "//outside.example/collect"
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)


@pytest.mark.parametrize("path", [
    ("socialLinks", 0, "id"),
    ("navigation", "links", 0, "id"),
    ("footer", "exploreLinks", 0, "id"),
    ("footer", "legalLinks", 0, "id"),
    ("homePage", "promoSlides", 0, "id"),
    ("contactPage", "eventTypes", 0, "id"),
    ("contactPage", "showOptions", 0, "id"),
    ("mediaItems", 0, "id"),
    ("packages", 0, "id"),
    ("faqs", 0, "id"),
    ("testimonials", 0, "id"),
    ("partners", 0, "id"),
    ("legalPages", "privacy", "sections", 0, "id"),
    ("legalPages", "terms", "sections", 0, "id"),
    ("legalPages", "cookies", "sections", 0, "id"),
])
def test_site_content_rejects_duplicate_identifiers_in_every_collection(default_content, path):
    target = default_content
    for key in path[:-2]:
        target = target[key]
    source = target[path[-2]] if isinstance(path[-2], str) else target
    if isinstance(source, list):
        source.append(deepcopy(source[0]))
    else:
        target.append(deepcopy(target[0]))

    with pytest.raises(ValidationError, match="identificatori unici"):
        SiteContent.model_validate(default_content)


def test_site_content_requires_company_details_and_normalizes_phone_values(default_content):
    default_content["siteDetails"]["taxId"] = ""
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)


@pytest.mark.parametrize(("field", "value"), [
    ("type", "script"),
    ("category", "Orice categorie"),
])
def test_site_content_rejects_unknown_media_enums(default_content, field, value):
    default_content["mediaItems"][0][field] = value
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)


def test_site_content_requires_nonempty_faqs_and_valid_referenced_media(default_content):
    default_content["faqs"][0]["a"] = ""
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)

    default_content = deepcopy(default_content)
    default_content["faqs"][0]["a"] = "Răspuns valid pentru întrebare."
    default_content["homePage"]["hero"]["backgroundMediaId"] = "media-lipsă"
    with pytest.raises(ValidationError, match="media-lipsă"):
        SiteContent.model_validate(default_content)


def test_site_content_enforces_text_lengths_retention_and_plain_legal_text(default_content):
    default_content["packages"][0]["title"] = "x" * 161
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)

    default_content = deepcopy(default_content)
    default_content["packages"][0]["title"] = "Gold"
    default_content["cookieSettings"]["retentionDays"] = 0
    with pytest.raises(ValidationError):
        SiteContent.model_validate(default_content)

    default_content = deepcopy(default_content)
    default_content["cookieSettings"]["retentionDays"] = 90
    default_content["legalPages"]["privacy"]["sections"][0]["paragraphs"] = ["<script>alert(1)</script>"]
    with pytest.raises(ValidationError, match="HTML"):
        SiteContent.model_validate(default_content)


def test_versioned_envelopes_use_validated_content(default_content):
    content = SiteContent.model_validate(default_content)
    draft_update = DraftUpdate(version=0, content=content)
    now = datetime.now(timezone.utc)
    draft = DraftResponse(
        version=1,
        base_revision_id=None,
        published_revision_id="revision-1",
        published_at=now,
        content=content,
        updated_at=now,
        updated_by="administrator",
    )
    publication = PublicationResponse(revision_id="revision-1", published_at=now, content=content)
    summary = RevisionSummary(id="revision-1", summary="Publicare", published_at=now, published_by="administrator")
    revision = RevisionResponse(**summary.model_dump(), content=content)

    assert draft_update.version == 0
    assert draft.version == 1
    assert publication.revision_id == revision.id
    assert PublishRequest(version=1, summary="Lansare").summary == "Lansare"
    assert RestoreRequest(version=1).version == 1
