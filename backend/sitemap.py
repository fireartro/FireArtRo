"""Server-generated sitemap for fixed routes and published Blog articles."""

from urllib.parse import quote
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response


CANONICAL_ORIGIN = "https://fireart.ro"
SITEMAP_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"
SITEMAP_UNAVAILABLE = "Sitemap-ul nu este disponibil momentan."
FIXED_PUBLIC_PATHS = (
    "/",
    "/pachete",
    "/galerie",
    "/intrebari-frecvente",
    "/contact",
    "/blog",
    "/confidentialitate",
    "/termeni-si-conditii",
    "/cookies",
)


def _append_url(urlset, location, last_modified=None):
    node = SubElement(urlset, "url")
    SubElement(node, "loc").text = location
    if last_modified:
        SubElement(node, "lastmod").text = str(last_modified)


def build_sitemap_xml(entries):
    urlset = Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for path in FIXED_PUBLIC_PATHS:
        _append_url(urlset, f"{CANONICAL_ORIGIN}{path}")

    for entry in entries:
        slug = str(entry.get("slug") or "").strip()
        if not slug:
            continue
        safe_slug = quote(slug, safe="-._~")
        _append_url(
            urlset,
            f"{CANONICAL_ORIGIN}/blog/{safe_slug}",
            entry.get("updated_at"),
        )

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(
        urlset,
        encoding="utf-8",
        short_empty_elements=True,
    )


def create_sitemap_router(blog_service, *, database_available=lambda: True):
    router = APIRouter(prefix="/api", tags=["sitemap"])

    @router.get("/sitemap.xml")
    async def sitemap():
        if not database_available():
            raise HTTPException(
                status_code=503,
                detail=SITEMAP_UNAVAILABLE,
                headers={"Cache-Control": "no-store"},
            )
        try:
            entries = await blog_service.list_sitemap_entries(limit=1000)
        except Exception:
            # Provider and database details must never be exposed to crawlers.
            raise HTTPException(
                status_code=503,
                detail=SITEMAP_UNAVAILABLE,
                headers={"Cache-Control": "no-store"},
            ) from None

        return Response(
            content=build_sitemap_xml(entries),
            media_type="application/xml",
            headers={"Cache-Control": SITEMAP_CACHE_CONTROL},
        )

    return router
