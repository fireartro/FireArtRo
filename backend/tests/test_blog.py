"""Behavior tests for the FireArtRo Blog API."""

from copy import deepcopy
import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import pytest

from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from blog import (
    BlogService,
    BlogArticleUpdate,
    MongoBlogRepository,
    create_blog_router,
    request_size_limit,
    slugify_ro,
)
from media import MediaWriteGuardMiddleware


async def authenticated_admin(x_admin_key: str | None = Header(default=None)):
    # Route tests inject a tiny auth boundary; production uses require_admin_session.
    if x_admin_key != "test-admin-key":
        raise HTTPException(status_code=401, detail="Acces neautorizat.")
    return object()


def article(article_id, slug, status, published_at, title):
    now = "2026-08-30T10:00:00+00:00"
    return {
        "id": article_id,
        "slug": slug,
        "title": title,
        "excerpt": f"Rezumat {title}",
        "body": f"Primul paragraf {title}.\n\nAl doilea paragraf.",
        "category": "Noutăți",
        "cover_media_id": "",
        "cover_alt": "",
        "status": status,
        "created_at": now,
        "updated_at": now,
        "published_at": published_at,
    }


class FakeBlogRepository:
    def __init__(self, posts=None):
        self.posts = [deepcopy(item) for item in (posts or [])]

    async def list_published(self, limit=None):
        items = [item for item in self.posts if item["status"] == "published"]
        items.sort(key=lambda item: item["published_at"] or "", reverse=True)
        return deepcopy(items[:limit] if limit else items)

    async def get_published_by_slug(self, slug):
        return deepcopy(
            next(
                (
                    item
                    for item in self.posts
                    if item["slug"] == slug and item["status"] == "published"
                ),
                None,
            )
        )

    async def list_sitemap_entries(self, limit=1000):
        items = [
            {
                "slug": item["slug"],
                "updated_at": item["updated_at"],
                "published_at": item["published_at"],
            }
            for item in self.posts
            if item["status"] == "published"
        ]
        items.sort(key=lambda item: (item["published_at"], item["slug"]), reverse=True)
        return [
            {"slug": item["slug"], "updated_at": item["updated_at"]}
            for item in deepcopy(items[:limit])
        ]

    async def list_all(self):
        return deepcopy(
            sorted(self.posts, key=lambda item: item["updated_at"], reverse=True)
        )

    async def get_by_id(self, article_id):
        return deepcopy(
            next((item for item in self.posts if item["id"] == article_id), None)
        )

    async def slug_exists(self, slug):
        return any(item["slug"] == slug for item in self.posts)

    async def insert(self, document):
        self.posts.append(deepcopy(document))
        return deepcopy(document)

    async def replace(self, article_id, document, expected_version=None):
        index = next(
            (
                index
                for index, item in enumerate(self.posts)
                if item["id"] == article_id and (expected_version is None or item.get("version", 1) == expected_version)
            ),
            -1,
        )
        if index < 0:
            return None
        self.posts[index] = deepcopy(document)
        return deepcopy(document)

    async def delete(self, article_id, expected_version=None):
        item = await self.get_by_id(article_id)
        if item and expected_version is not None and item.get("version", 1) != expected_version:
            return None
        self.posts = [post for post in self.posts if post["id"] != article_id]
        return item

    async def cover_is_referenced(self, media_id):
        return any(item.get("cover_media_id") == media_id for item in self.posts)

    async def public_revision_entries(self):
        return [
            {key: item[key] for key in ("id", "version", "updated_at") if key in item}
            for item in self.posts if item["status"] == "published"
        ]


class FakeMediaStore:
    def __init__(self):
        self.items = {}
        self.deleted = []

    async def save(self, filename, content_type, data):
        media_id = "507f1f77bcf86cd799439011"
        self.items[media_id] = {
            "filename": filename,
            "content_type": content_type,
            "data": data,
        }
        return media_id

    async def open(self, media_id):
        return deepcopy(self.items.get(media_id))

    async def delete(self, media_id):
        self.deleted.append(media_id)
        self.items.pop(media_id, None)


def public_client(posts):
    app = FastAPI()
    service = BlogService(FakeBlogRepository(posts), FakeMediaStore())
    app.include_router(create_blog_router(service, authenticated_admin))
    return TestClient(app)


def admin_client(posts=None):
    repository = FakeBlogRepository(posts)
    media_store = FakeMediaStore()
    service = BlogService(repository, media_store)
    app = FastAPI()
    app.include_router(create_blog_router(service, authenticated_admin))
    return TestClient(app), repository, media_store


def valid_create(**overrides):
    payload = {
        "title": "Știri din culise",
        "excerpt": "Un rezumat administrat.",
        "body": "Primul paragraf.\n\nAl doilea paragraf.",
        "category": "Noutăți",
        "cover_media_id": "",
        "cover_alt": "",
    }
    payload.update(overrides)
    return payload


def test_slugify_ro_normalizes_diacritics_and_symbols():
    assert slugify_ro("Știri: Artificii în Țară") == "stiri-artificii-in-tara"


def test_public_list_returns_only_published_newest_first_and_honors_limit():
    posts = [
        article("1", "vechi", "published", "2026-08-10T09:00:00+00:00", "Vechi"),
        article("2", "draft", "draft", None, "Draft"),
        article("3", "nou", "published", "2026-08-30T09:00:00+00:00", "Nou"),
        article("4", "mijloc", "published", "2026-08-20T09:00:00+00:00", "Mijloc"),
    ]

    response = public_client(posts).get("/api/blog/posts?limit=2")

    assert response.status_code == 200
    assert [item["slug"] for item in response.json()] == ["nou", "mijloc"]
    assert all(item["slug"] != "draft" for item in response.json())
    assert all("body" not in item for item in response.json())


def test_sitemap_entries_are_published_only_bounded_and_without_article_content():
    posts = [
        article("1", "vechi", "published", "2026-08-10T09:00:00+00:00", "Vechi"),
        article("2", "draft-secret", "draft", None, "Draft secret"),
        article("3", "nou", "published", "2026-08-30T09:00:00+00:00", "Nou"),
    ]
    service = BlogService(FakeBlogRepository(posts), FakeMediaStore())

    import asyncio

    entries = asyncio.run(service.list_sitemap_entries(limit=1))

    assert entries == [
        {"slug": "nou", "updated_at": "2026-08-30T10:00:00+00:00"}
    ]
    assert "draft-secret" not in str(entries)
    assert "body" not in entries[0]


def test_public_detail_hides_drafts_as_not_found():
    posts = [article("2", "draft", "draft", None, "Draft")]

    response = public_client(posts).get("/api/blog/posts/draft")

    assert response.status_code == 404
    assert response.json() == {"detail": "Articolul nu a fost găsit."}


def test_public_list_rejects_out_of_range_limit():
    response = public_client([]).get("/api/blog/posts?limit=101")

    assert response.status_code == 422


def test_admin_routes_reject_missing_or_wrong_key():
    client, _, _ = admin_client()

    assert client.get("/api/admin/blog/posts").status_code == 401
    assert (
        client.get(
            "/api/admin/blog/posts",
            headers={"X-Admin-Key": "wrong"},
        ).status_code
        == 401
    )


def test_create_always_starts_as_draft_and_duplicate_title_gets_unique_slug():
    client, _, _ = admin_client()
    headers = {"X-Admin-Key": "test-admin-key"}

    first = client.post("/api/admin/blog/posts", json=valid_create(), headers=headers)
    second = client.post("/api/admin/blog/posts", json=valid_create(), headers=headers)

    assert first.status_code == 201
    assert first.json()["status"] == "draft"
    assert first.json()["published_at"] is None
    assert first.json()["slug"] == "stiri-din-culise"
    assert second.status_code == 201
    assert second.json()["slug"] == "stiri-din-culise-2"


def test_publish_sets_date_once_and_title_edit_keeps_slug_and_publication_date():
    client, _, _ = admin_client()
    headers = {"X-Admin-Key": "test-admin-key"}
    created = client.post(
        "/api/admin/blog/posts",
        json=valid_create(),
        headers=headers,
    ).json()
    publish_payload = {**valid_create(), "status": "published", "version": 1}

    published = client.put(
        f"/api/admin/blog/posts/{created['id']}",
        json=publish_payload,
        headers=headers,
    )
    edited = client.put(
        f"/api/admin/blog/posts/{created['id']}",
        json={**publish_payload, "title": "Titlu schimbat", "version": 2},
        headers=headers,
    )

    assert published.status_code == 200
    assert published.json()["published_at"]
    assert edited.status_code == 200
    assert edited.json()["slug"] == created["slug"]
    assert edited.json()["published_at"] == published.json()["published_at"]


def test_delete_removes_article_from_admin_and_public_lists():
    client, _, _ = admin_client()
    headers = {"X-Admin-Key": "test-admin-key"}
    created = client.post(
        "/api/admin/blog/posts",
        json=valid_create(),
        headers=headers,
    ).json()

    response = client.delete(
        f"/api/admin/blog/posts/{created['id']}?version=1",
        headers=headers,
    )

    assert response.status_code == 204
    assert client.get("/api/admin/blog/posts", headers=headers).json() == []
    assert client.get("/api/blog/posts").json() == []


def test_article_rejects_malformed_cover_identifier():
    client, _, _ = admin_client()

    response = client.post(
        "/api/admin/blog/posts",
        json=valid_create(
            cover_media_id="not-an-object-id",
            cover_alt="Copertă",
        ),
        headers={"X-Admin-Key": "test-admin-key"},
    )

    assert response.status_code == 422


def test_admin_update_rejects_malformed_article_identifier():
    client, _, _ = admin_client()

    response = client.put(
        "/api/admin/blog/posts/not-a-uuid",
        json={**valid_create(), "status": "draft"},
        headers={"X-Admin-Key": "test-admin-key"},
    )

    assert response.status_code == 422


def test_media_upload_requires_admin_and_public_read_returns_exact_bytes():
    client, _, _ = admin_client()
    webp_bytes = b"RIFF\x04\x00\x00\x00WEBP"
    files = {"file": ("coperta.webp", webp_bytes, "image/webp")}

    assert client.post("/api/admin/blog/media", files=files).status_code == 401
    uploaded = client.post(
        "/api/admin/blog/media",
        files=files,
        headers={"X-Admin-Key": "test-admin-key"},
    )

    assert uploaded.status_code == 201
    media_id = uploaded.json()["id"]
    public = client.get(f"/api/blog/media/{media_id}")
    assert public.status_code == 200
    assert public.content == webp_bytes
    assert public.headers["content-type"].startswith("image/webp")
    assert (
        public.headers["cache-control"]
        == "public, max-age=86400, stale-while-revalidate=604800"
    )


def test_media_upload_rejects_non_image_and_false_image_types():
    client, _, _ = admin_client()
    headers = {"X-Admin-Key": "test-admin-key"}

    text_response = client.post(
        "/api/admin/blog/media",
        files={"file": ("payload.txt", b"not-an-image", "text/plain")},
        headers=headers,
    )
    false_webp_response = client.post(
        "/api/admin/blog/media",
        files={"file": ("payload.webp", b"not-an-image", "image/webp")},
        headers=headers,
    )

    assert text_response.status_code == 415
    assert false_webp_response.status_code == 415


def test_replacing_cover_deletes_old_media_only_after_article_save():
    old_cover = "507f1f77bcf86cd799439012"
    article_id = "6f69e970-5d5d-46fc-8593-62c00bf46101"
    posts = [
        article(article_id, "articol", "draft", None, "Articol")
        | {"cover_media_id": old_cover, "cover_alt": "Copertă veche"}
    ]
    client, _, media_store = admin_client(posts)
    media_store.items["507f1f77bcf86cd799439013"] = {
        "content_type": "image/webp", "data": b"RIFF1234WEBP",
    }

    response = client.put(
        f"/api/admin/blog/posts/{article_id}",
        json={
            **valid_create(),
            "status": "draft",
            "version": 1,
            "cover_media_id": "507f1f77bcf86cd799439013",
            "cover_alt": "Copertă nouă",
        },
        headers={"X-Admin-Key": "test-admin-key"},
    )

    assert response.status_code == 200
    assert media_store.deleted == [old_cover]


ARTICLE_ID = "6f69e970-5d5d-46fc-8593-62c00bf46101"
ADMIN_HEADERS = {"X-Admin-Key": "test-admin-key"}


def test_stale_editor_update_and_delete_return_conflict_without_losing_winner():
    client, repository, _ = admin_client([
        article(ARTICLE_ID, "articol", "draft", None, "Original")
    ])
    listed = client.get("/api/admin/blog/posts", headers=ADMIN_HEADERS).json()
    assert listed[0].get("version") == 1
    path = f"/api/admin/blog/posts/{ARTICLE_ID}"
    first = client.put(path, json={**valid_create(title="Winner"), "status": "draft", "version": 1}, headers=ADMIN_HEADERS)
    assert first.status_code == 200
    assert first.json()["version"] == 2
    stale = client.put(path, json={**valid_create(title="Stale"), "status": "draft", "version": 1}, headers=ADMIN_HEADERS)
    assert stale.status_code == 409
    assert client.delete(f"{path}?version=1", headers=ADMIN_HEADERS).status_code == 409
    assert repository.posts[0]["title"] == "Winner"
    assert client.delete(f"{path}?version=2", headers=ADMIN_HEADERS).status_code == 204


@pytest.mark.asyncio
async def test_two_editors_reading_same_version_have_only_one_atomic_winner():
    class BothEditorsRepository(FakeBlogRepository):
        def __init__(self):
            super().__init__([article(ARTICLE_ID, "articol", "draft", None, "Original")])
            self.reads = 0
            self.both_read = asyncio.Event()

        async def get_by_id(self, article_id):
            snapshot = await super().get_by_id(article_id)
            self.reads += 1
            if self.reads == 2:
                self.both_read.set()
            await self.both_read.wait()
            return snapshot

    repository = BothEditorsRepository()
    service = BlogService(repository, FakeMediaStore())
    outcomes = await asyncio.gather(*[
        service.update_article(ARTICLE_ID, BlogArticleUpdate(**valid_create(title=title), status="draft", version=1))
        for title in ("First", "Second")
    ], return_exceptions=True)
    assert sum(isinstance(result, dict) for result in outcomes) == 1
    assert [result.status_code for result in outcomes if isinstance(result, HTTPException)] == [409]
    assert repository.posts[0]["version"] == 2


@pytest.mark.parametrize("operation", ["replace", "delete"])
def test_shared_cover_survives_when_another_article_still_references_it(operation):
    cover = "507f1f77bcf86cd799439012"
    posts = [article(ARTICLE_ID, "first", "draft", None, "First"), article("second", "second", "published", "2026-09-01", "Second")]
    for post in posts:
        post.update(cover_media_id=cover, cover_alt="Shared")
    client, repository, media = admin_client(posts)
    media.items[cover] = {"content_type": "image/webp", "data": b"RIFF1234WEBP"}
    path = f"/api/admin/blog/posts/{ARTICLE_ID}"
    if operation == "replace":
        result = client.put(path, json={**valid_create(), "status": "draft", "version": 1}, headers=ADMIN_HEADERS)
        assert result.status_code == 200
    else:
        assert client.delete(f"{path}?version=1", headers=ADMIN_HEADERS).status_code == 204
    assert repository.posts[-1]["cover_media_id"] == cover
    assert client.get(f"/api/blog/media/{cover}").status_code == 200
    assert media.deleted == []


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("media_value,expected_status", [
    (None, 422),
    ({"content_type": "text/html", "data": b"<script>bad</script>"}, 415),
    ({"content_type": "image/webp", "data": b"not-an-image"}, 415),
])
def test_invalid_cover_is_rejected_before_article_changes(operation, media_value, expected_status):
    cover = "000000000000000000000000"
    client, repository, media = admin_client([article(ARTICLE_ID, "original", "draft", None, "Original")])
    if media_value is not None:
        media.items[cover] = media_value
    payload = valid_create(cover_media_id=cover, cover_alt="Cover")
    if operation == "create":
        result = client.post("/api/admin/blog/posts", json=payload, headers=ADMIN_HEADERS)
    else:
        result = client.put(f"/api/admin/blog/posts/{ARTICLE_ID}", json={**payload, "status": "published", "version": 1}, headers=ADMIN_HEADERS)
    assert result.status_code == expected_status
    assert len(repository.posts) == 1
    assert repository.posts[0]["title"] == "Original"


@pytest.mark.parametrize("version", [None, 0, -1, 1.5, True, "1"])
def test_update_requires_explicit_positive_integer_version(version):
    client, _, _ = admin_client([article(ARTICLE_ID, "first", "draft", None, "First")])
    payload = {**valid_create(), "status": "draft"}
    if version is not None:
        payload["version"] = version
    assert client.put(f"/api/admin/blog/posts/{ARTICLE_ID}", json=payload, headers=ADMIN_HEADERS).status_code == 422


def test_delete_requires_version_and_create_starts_at_version_one():
    client, _, _ = admin_client()
    created = client.post("/api/admin/blog/posts", json=valid_create(), headers=ADMIN_HEADERS).json()
    assert created.get("version") == 1
    assert client.delete(f"/api/admin/blog/posts/{created['id']}", headers=ADMIN_HEADERS).status_code == 422


def test_public_revision_changes_only_for_publication_and_public_mutations():
    client, _, _ = admin_client()
    def revision():
        result = client.get("/api/blog/revision")
        assert result.status_code == 200
        assert set(result.json()) == {"revision_id"}
        assert "no-store" in result.headers["cache-control"]
        return result.json()["revision_id"]
    empty_revision = revision()
    created = client.post("/api/admin/blog/posts", json=valid_create(title="Secret draft"), headers=ADMIN_HEADERS).json()
    assert revision() == empty_revision
    path = f"/api/admin/blog/posts/{created['id']}"
    payload = {**valid_create(), "status": "published", "version": 1}
    assert client.put(path, json=payload, headers=ADMIN_HEADERS).status_code == 200
    published_revision = revision()
    assert published_revision != empty_revision
    assert client.put(path, json={**payload, "body": "New public body", "version": 2}, headers=ADMIN_HEADERS).status_code == 200
    assert revision() != published_revision
    latest = client.get("/api/blog/revision")
    assert client.get("/api/blog/revision", headers={"If-None-Match": latest.headers["etag"]}).status_code == 304
    assert client.put(path, json={**payload, "status": "draft", "version": 3}, headers=ADMIN_HEADERS).status_code == 200
    assert revision() == empty_revision
    assert client.put(path, json={**payload, "body": "Secret draft edit", "status": "draft", "version": 4}, headers=ADMIN_HEADERS).status_code == 200
    assert revision() == empty_revision
    assert client.put(path, json={**payload, "version": 5}, headers=ADMIN_HEADERS).status_code == 200
    assert revision() != empty_revision
    assert client.delete(f"{path}?version=6", headers=ADMIN_HEADERS).status_code == 204
    assert revision() == empty_revision


class AtomicCollection:
    """Small Mongo boundary double: query matching affects real stored documents."""
    def __init__(self, document):
        self.document = deepcopy(document)

    def matches(self, query):
        if self.document is None:
            return False
        for key, value in query.items():
            if key == "$or":
                if not any(self.matches(branch) for branch in value):
                    return False
            elif isinstance(value, dict) and "$exists" in value:
                if (key in self.document) != value["$exists"]:
                    return False
            elif self.document.get(key) != value:
                return False
        return True

    async def replace_one(self, query, document):
        matched = self.matches(query)
        if matched:
            self.document = deepcopy(document)
        return SimpleNamespace(matched_count=int(matched))

    async def find_one_and_delete(self, query, projection):
        if not self.matches(query):
            return None
        document = self.document
        self.document = None
        return deepcopy(document)


@pytest.mark.asyncio
@pytest.mark.parametrize("legacy", [True, False])
async def test_mongo_cas_preserves_winner_for_stale_replacement_and_deletion(legacy):
    original = article(ARTICLE_ID, "original", "draft", None, "Original")
    if not legacy:
        original["version"] = 1
    collection = AtomicCollection(original)
    repository = MongoBlogRepository(collection)
    winner = {**original, "title": "Winner", "version": 2}
    assert await repository.replace(ARTICLE_ID, winner, 1) == winner
    assert await repository.replace(ARTICLE_ID, {**winner, "title": "Stale"}, 1) is None
    assert await repository.delete(ARTICLE_ID, 1) is None
    assert collection.document == winner
    assert await repository.delete(ARTICLE_ID, 2) == winner
    assert collection.document is None


@pytest.mark.asyncio
async def test_cover_validation_and_attachment_share_http_guard_with_cover_deletion(monkeypatch):
    import media as media_module
    cover = "507f1f77bcf86cd799439012"
    other_id = "6f69e970-5d5d-46fc-8593-62c00bf46102"
    owner = article(ARTICLE_ID, "owner", "draft", None, "Owner")
    owner.update(cover_media_id=cover, cover_alt="Cover")
    repository = FakeBlogRepository([owner, article(other_id, "other", "draft", None, "Other")])
    validating, release = asyncio.Event(), asyncio.Event()

    class DeferredMediaStore(FakeMediaStore):
        async def open(self, media_id):
            snapshot = await super().open(media_id)
            validating.set()
            await release.wait()
            return snapshot

    store = DeferredMediaStore()
    store.items[cover] = {"content_type": "image/webp", "data": b"RIFF1234WEBP"}

    class Guard:
        locked = False

        @asynccontextmanager
        async def reference_write_guard(self, content=None):
            if self.locked:
                raise HTTPException(409, "Write in progress")
            self.locked = True
            try:
                yield
            finally:
                self.locked = False

    async def middleware_admin(*args):
        return object()

    monkeypatch.setattr(media_module, "require_admin_session", middleware_admin)
    app = FastAPI()
    app.add_middleware(MediaWriteGuardMiddleware, service=Guard())
    app.include_router(create_blog_router(BlogService(repository, store), authenticated_admin))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://local.test") as client:
        attaching = asyncio.create_task(client.put(
            f"/api/admin/blog/posts/{other_id}",
            json={**valid_create(cover_media_id=cover, cover_alt="Shared"), "status": "draft", "version": 1}, headers=ADMIN_HEADERS,
        ))
        await asyncio.wait_for(validating.wait(), 2)
        deleting = await client.delete(f"/api/admin/blog/posts/{ARTICLE_ID}?version=1", headers=ADMIN_HEADERS)
        assert deleting.status_code == 409
        release.set()
        assert (await attaching).status_code == 200
        assert (await client.delete(f"/api/admin/blog/posts/{ARTICLE_ID}?version=1", headers=ADMIN_HEADERS)).status_code == 204
        assert cover in store.items
        assert store.deleted == []


def test_request_limits_are_scoped_to_blog_writes_and_media_only():
    assert request_size_limit("/api/quotes", "POST") == 32_768
    assert request_size_limit("/api/admin/blog/posts", "POST") == 128 * 1024
    assert (
        request_size_limit(
            "/api/admin/blog/posts/6f69e970-5d5d-46fc-8593-62c00bf46101",
            "PUT",
        )
        == 128 * 1024
    )
    assert request_size_limit("/api/admin/blog/media", "POST") == 6 * 1024 * 1024
    assert request_size_limit("/api/webhooks/resend", "POST") == 64 * 1024
    assert (
        request_size_limit("/api/admin/inbox/inbound-001/reply", "POST") == 128 * 1024
    )
    assert request_size_limit("/api/blog/posts", "GET") == 32_768
