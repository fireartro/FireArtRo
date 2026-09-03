"""Behavior tests for the public reviews gateway."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx

from reviews import ReviewsService, create_reviews_router


GOOGLE_ENV = {
    "GOOGLE_PLACES_API_KEY": "google-secret",
    "GOOGLE_PLACE_ID": "ChIJFireArtRo",
}

FACEBOOK_ENV = {
    "META_PAGE_ID": "123456789",
    "META_PAGE_ACCESS_TOKEN": "meta-secret",
    "META_GRAPH_API_VERSION": "v99.0",
}

GOOGLE_PAYLOAD = {
    "displayName": {"text": "FireArtRo", "languageCode": "ro"},
    "googleMapsUri": "https://maps.google.com/?cid=fireartro",
    "reviews": [
        {
            "name": "places/ChIJFireArtRo/reviews/google-1",
            "rating": 5,
            "text": {"text": "Un spectacol impecabil.", "languageCode": "ro"},
            "authorAttribution": {
                "displayName": "Ana M.",
                "uri": "https://maps.google.com/contrib/ana",
            },
            "publishTime": "2026-08-20T18:30:00Z",
            "googleMapsUri": "https://maps.google.com/review/google-1",
        },
        {
            "name": "places/ChIJFireArtRo/reviews/google-empty",
            "rating": 5,
            "text": {"text": "   ", "languageCode": "ro"},
            "authorAttribution": {"displayName": "Fără text"},
        },
    ],
}

FACEBOOK_PAYLOAD = {
    "data": [
        {
            "id": "facebook-1",
            "review_text": "Organizare excelentă și un show memorabil.",
            "rating": 5,
            "created_time": "2026-08-18T20:00:00+0000",
            "reviewer": {"name": "Mihai P."},
        }
    ]
}


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.request = httpx.Request("GET", "https://provider.example/reviews")

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "provider failure",
                request=self.request,
                response=httpx.Response(self.status_code, request=self.request),
            )

    def json(self):
        return self.payload


class FakeAsyncClient:
    def __init__(self, google=None, facebook=None):
        self.google = google
        self.facebook = facebook
        self.calls = []

    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if "places.googleapis.com" in url:
            return self.google
        if "graph.facebook.com" in url:
            return self.facebook
        raise AssertionError(f"Unexpected provider URL: {url}")


def public_client(env, fake_client, ttl_seconds=900, now=lambda: 0):
    app = FastAPI()
    service = ReviewsService(
        env=env,
        http_client=fake_client,
        ttl_seconds=ttl_seconds,
        now=now,
    )
    app.include_router(create_reviews_router(service))
    return TestClient(app), service


def test_missing_or_partial_credentials_keep_reviews_absent():
    client, _ = public_client(
        {"GOOGLE_PLACES_API_KEY": "google-secret", "META_PAGE_ID": "123"},
        FakeAsyncClient(),
    )

    response = client.get("/api/reviews")

    assert response.status_code == 200
    assert response.json() == {"providers": []}


def test_google_reviews_are_normalized_and_empty_text_is_omitted():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client(GOOGLE_ENV, fake)

    response = client.get("/api/reviews")

    assert response.status_code == 200
    assert response.json() == {
        "providers": [
            {
                "id": "google",
                "href": "https://maps.google.com/?cid=fireartro",
                "reviews": [
                    {
                        "id": "places/ChIJFireArtRo/reviews/google-1",
                        "provider": "google",
                        "author": "Ana M.",
                        "text": "Un spectacol impecabil.",
                        "rating": 5.0,
                        "published_at": "2026-08-20T18:30:00Z",
                        "url": "https://maps.google.com/review/google-1",
                    }
                ],
            }
        ]
    }
    url, options = fake.calls[0]
    assert url.endswith("/v1/places/ChIJFireArtRo")
    assert options["headers"]["X-Goog-Api-Key"] == "google-secret"
    assert "reviews" in options["headers"]["X-Goog-FieldMask"]


def test_one_provider_failure_does_not_hide_the_other_or_expose_secrets():
    fake = FakeAsyncClient(
        google=FakeResponse({"error": "denied"}, status_code=403),
        facebook=FakeResponse(FACEBOOK_PAYLOAD),
    )
    client, _ = public_client({**GOOGLE_ENV, **FACEBOOK_ENV}, fake)

    response = client.get("/api/reviews")

    assert response.status_code == 200
    payload = response.json()
    assert [provider["id"] for provider in payload["providers"]] == ["facebook"]
    assert payload["providers"][0]["reviews"][0] == {
        "id": "facebook-1",
        "provider": "facebook",
        "author": "Mihai P.",
        "text": "Organizare excelentă și un show memorabil.",
        "rating": 5.0,
        "published_at": "2026-08-18T20:00:00+0000",
        "url": "",
    }
    serialized = response.text
    assert "google-secret" not in serialized
    assert "meta-secret" not in serialized


def test_snapshot_is_reused_until_the_cache_expires():
    clock = {"value": 100.0}
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client(
        GOOGLE_ENV,
        fake,
        ttl_seconds=60,
        now=lambda: clock["value"],
    )

    first = client.get("/api/reviews")
    second = client.get("/api/reviews")
    clock["value"] = 161.0
    third = client.get("/api/reviews")

    assert first.json() == second.json() == third.json()
    assert len(fake.calls) == 2
