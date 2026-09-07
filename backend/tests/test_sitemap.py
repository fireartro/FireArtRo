"""Public sitemap behavior for fixed pages and Admin-published Blog posts."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sitemap import CANONICAL_ORIGIN, create_sitemap_router


class FakeBlogService:
    def __init__(self, entries=None, *, failure=None):
        self.entries = entries or []
        self.failure = failure
        self.requested_limits = []

    async def list_sitemap_entries(self, limit=1000):
        self.requested_limits.append(limit)
        if self.failure:
            raise self.failure
        return list(self.entries)


def client_for(entries=None, *, database_available=True, failure=None):
    app = FastAPI()
    service = FakeBlogService(entries, failure=failure)
    app.include_router(
        create_sitemap_router(
            service,
            database_available=lambda: database_available,
        )
    )
    return TestClient(app), service


def test_sitemap_uses_canonical_origin_and_fixed_public_routes_only():
    client, _ = client_for()

    response = client.get(
        "/api/sitemap.xml",
        headers={"host": "attacker.example", "x-forwarded-host": "attacker.example"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert response.headers["cache-control"] == (
        "public, max-age=300, stale-while-revalidate=3600"
    )
    assert f"<loc>{CANONICAL_ORIGIN}/</loc>" in response.text
    for path in (
        "/pachete",
        "/galerie",
        "/intrebari-frecvente",
        "/contact",
        "/blog",
        "/confidentialitate",
        "/termeni-si-conditii",
        "/cookies",
    ):
        assert f"<loc>{CANONICAL_ORIGIN}{path}</loc>" in response.text
    assert "/admin" not in response.text
    assert "attacker.example" not in response.text


def test_sitemap_adds_only_service_supplied_published_entries_deterministically():
    entries = [
        {"slug": "nou-si-bun", "updated_at": "2026-09-07T12:00:00+00:00"},
        {"slug": "titlu & neobisnuit", "updated_at": "2026-09-06T10:00:00+00:00"},
    ]
    client, service = client_for(entries)

    first = client.get("/api/sitemap.xml")
    second = client.get("/api/sitemap.xml")

    assert first.text == second.text
    assert service.requested_limits == [1000, 1000]
    assert f"<loc>{CANONICAL_ORIGIN}/blog/nou-si-bun</loc>" in first.text
    assert (
        f"<loc>{CANONICAL_ORIGIN}/blog/titlu%20%26%20neobisnuit</loc>"
        in first.text
    )
    assert "<lastmod>2026-09-07T12:00:00+00:00</lastmod>" in first.text
    assert first.text.index("/blog/nou-si-bun") < first.text.index(
        "/blog/titlu%20%26%20neobisnuit"
    )


def test_sitemap_fails_closed_when_database_or_query_is_unavailable():
    unavailable, _ = client_for(database_available=False)
    failed, _ = client_for(failure=RuntimeError("database details must stay private"))

    for response in (
        unavailable.get("/api/sitemap.xml"),
        failed.get("/api/sitemap.xml"),
    ):
        assert response.status_code == 503
        assert response.headers["cache-control"] == "no-store"
        assert response.json() == {"detail": "Sitemap-ul nu este disponibil momentan."}
        assert "database details" not in response.text
