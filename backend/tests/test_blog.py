"""Behavior tests for the FireArtRo Blog API."""

from copy import deepcopy

from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from blog import (
    BlogService,
    create_blog_router,
    request_size_limit,
    slugify_ro,
)


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

    async def replace(self, article_id, document):
        index = next(
            (
                index
                for index, item in enumerate(self.posts)
                if item["id"] == article_id
            ),
            -1,
        )
        if index < 0:
            return None
        self.posts[index] = deepcopy(document)
        return deepcopy(document)

    async def delete(self, article_id):
        item = await self.get_by_id(article_id)
        self.posts = [post for post in self.posts if post["id"] != article_id]
        return item


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
    publish_payload = {**valid_create(), "status": "published"}

    published = client.put(
        f"/api/admin/blog/posts/{created['id']}",
        json=publish_payload,
        headers=headers,
    )
    edited = client.put(
        f"/api/admin/blog/posts/{created['id']}",
        json={**publish_payload, "title": "Titlu schimbat"},
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
        f"/api/admin/blog/posts/{created['id']}",
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

    response = client.put(
        f"/api/admin/blog/posts/{article_id}",
        json={
            **valid_create(),
            "status": "draft",
            "cover_media_id": "507f1f77bcf86cd799439013",
            "cover_alt": "Copertă nouă",
        },
        headers={"X-Admin-Key": "test-admin-key"},
    )

    assert response.status_code == 200
    assert media_store.deleted == [old_cover]


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
