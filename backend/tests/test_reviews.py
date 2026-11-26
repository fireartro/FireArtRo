"""Behavior tests for the public reviews gateway."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import threading
import httpx
import pytest

from reviews import ReviewsService, create_reviews_router
from review_budget import MongoReviewBudget, ReviewBudgetError
from test_auth import MemoryCollection, password_hash, server_loader


GOOGLE_ENV = {
    "GOOGLE_PLACES_API_KEY": "google-secret",
    "GOOGLE_PLACE_ID": "ChIJFireArtRo",
}

LEGACY_META_ENV = {
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
                "photoUri": "https://lh3.googleusercontent.com/ana-photo",
            },
            "publishTime": "2026-08-20T18:30:00Z",
            "relativePublishTimeDescription": "acum 3 săptămâni",
            "originalText": {"text": "A wonderful show.", "languageCode": "en"},
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
    def __init__(self, google=None):
        self.google = google
        self.calls = []

    async def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if "places.googleapis.com" in url:
            return self.google
        raise AssertionError(f"Unexpected provider URL: {url}")


def public_client(env, fake_client, now=lambda: 0):
    app = FastAPI()
    service = ReviewsService(
        env=env,
        http_client=fake_client,
        budget=MongoReviewBudget(
            MemoryCollection(), "review-test-secret-with-at-least-32-bytes",
            clock=lambda: datetime.fromtimestamp(now(), tz=timezone.utc),
        ),
    )
    app.include_router(create_reviews_router(service))
    return TestClient(app), service


def test_missing_or_partial_credentials_keep_reviews_absent():
    client, _ = public_client(
        {"GOOGLE_PLACES_API_KEY": "google-secret"},
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
                        "published_relative": "acum 3 săptămâni",
                        "original_text": "A wonderful show.",
                        "translated": True,
                        "url": "https://maps.google.com/review/google-1",
                        "author_url": "https://maps.google.com/contrib/ana",
                        "author_photo_url": "https://lh3.googleusercontent.com/ana-photo",
                    }
                ],
            }
        ]
    }
    url, options = fake.calls[0]
    assert url.endswith("/v1/places/ChIJFireArtRo")
    assert options["headers"]["X-Goog-Api-Key"] == "google-secret"
    assert "reviews" in options["headers"]["X-Goog-FieldMask"]
    assert options["params"] == {"languageCode": "ro"}


def test_google_failure_returns_no_reviews_or_credentials():
    fake = FakeAsyncClient(google=FakeResponse({"error": "denied"}, status_code=403))
    client, _ = public_client(GOOGLE_ENV, fake)

    response = client.get("/api/reviews")

    assert response.status_code == 200
    assert response.json() == {"providers": []}


def test_legacy_meta_configuration_never_triggers_a_review_request():
    fake = FakeAsyncClient()
    client, service = public_client(LEGACY_META_ENV, fake)

    response = client.get("/api/reviews")
    health = asyncio.run(service.integration_health())

    assert len(fake.calls) == 0
    assert response.status_code == 200
    assert response.json() == {"providers": []}
    assert health == {
        "google": {"configured": False, "healthy": None, "checked_at": None, "review_count": None},
    }


def test_google_content_is_fetched_per_request_with_legacy_meta_configuration():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client({**GOOGLE_ENV, **LEGACY_META_ENV}, fake)

    first = client.get("/api/reviews")
    second = client.get("/api/reviews")

    assert first.status_code == second.status_code == 200
    assert len(fake.calls) == 2
    assert all(url.startswith("https://places.googleapis.com/") for url, _ in fake.calls)
    assert [provider["id"] for provider in first.json()["providers"]] == ["google"]
    assert first.json() == second.json()


def test_reviews_route_disables_intermediary_caching():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client(GOOGLE_ENV, fake)

    response = client.get("/api/reviews")

    assert response.headers["cache-control"] == "no-store, private"


def test_google_failure_does_not_reuse_a_previous_google_snapshot():
    class RevokedGoogleClient(FakeAsyncClient):
        def __init__(self):
            super().__init__(google=FakeResponse(GOOGLE_PAYLOAD))
            self.google_requests = 0

        async def get(self, url, **kwargs):
            if "places.googleapis.com" in url:
                self.google_requests += 1
                if self.google_requests > 1:
                    return FakeResponse({"error": "denied"}, status_code=403)
            return await super().get(url, **kwargs)

    fake = RevokedGoogleClient()
    client, _ = public_client(GOOGLE_ENV, fake)

    assert client.get("/api/reviews").json()["providers"][0]["id"] == "google"
    assert client.get("/api/reviews").json() == {"providers": []}


def test_empty_reviews_are_distinguished_from_provider_failure_in_private_health():
    fake = FakeAsyncClient(google=FakeResponse({"reviews": []}))
    client, service = public_client(GOOGLE_ENV, fake)
    assert client.get("/api/reviews").json() == {"providers": []}
    state = asyncio.run(service.integration_health())
    assert state["google"]["configured"] is True
    assert state["google"]["healthy"] is True
    assert state["google"]["review_count"] == 0
    fake.google = FakeResponse({}, status_code=403)
    failed = asyncio.run(service.integration_health())
    assert failed["google"]["healthy"] is False
    assert failed["google"]["review_count"] is None


def test_anonymous_repetition_is_rejected_before_consuming_more_provider_quota():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client(GOOGLE_ENV, fake)

    responses = [client.get("/api/reviews") for _ in range(24)]

    assert sum(response.status_code == 200 for response in responses) == 10
    assert sum(response.status_code == 429 for response in responses) == 14
    assert len(fake.calls) == 10
    for response in responses[10:]:
        assert int(response.headers["retry-after"]) > 0
        assert response.headers["cache-control"] == "no-store, private"
        assert "google-secret" not in response.text


@pytest.mark.asyncio
async def test_concurrent_waiters_share_only_the_running_provider_call():
    entered, release = asyncio.Event(), asyncio.Event()

    class SlowClient(FakeAsyncClient):
        async def get(self, url, **kwargs):
            result = await super().get(url, **kwargs)
            entered.set()
            await release.wait()
            return result

    fake = SlowClient(google=FakeResponse(GOOGLE_PAYLOAD))
    _, service = public_client(GOOGLE_ENV, fake)
    tasks = [asyncio.create_task(service.get_snapshot(client_ip=f"192.0.2.{i}")) for i in range(24)]
    await entered.wait()
    await asyncio.sleep(0)
    assert len(fake.calls) == 1
    release.set()
    results = await asyncio.gather(*tasks)
    assert all(result == results[0] for result in results)
    await service.get_snapshot()
    assert len(fake.calls) == 2  # Completed Google content is not cached.
    assert service._inflight == {}


def test_different_runtime_loops_use_shared_guard_instead_of_awaiting_foreign_task():
    entered, release = threading.Event(), threading.Event()

    class ThreadedClient(FakeAsyncClient):
        async def get(self, url, **kwargs):
            response = await super().get(url, **kwargs)
            entered.set()
            await asyncio.to_thread(release.wait, 3)
            return response

    fake = ThreadedClient(google=FakeResponse(GOOGLE_PAYLOAD))
    _, service = public_client(GOOGLE_ENV, fake)
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(asyncio.run, service.get_snapshot())
        assert entered.wait(2)
        try:
            with pytest.raises(ReviewBudgetError) as error:
                asyncio.run(service.get_snapshot())
            assert error.value.status_code == 429
        finally:
            release.set()
            assert first.result(timeout=3)["providers"][0]["id"] == "google"
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_cancelled_first_waiter_does_not_close_the_shared_http_client(monkeypatch):
    import reviews
    entered, release = asyncio.Event(), asyncio.Event()

    class ManagedClient(FakeAsyncClient):
        closed = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            self.closed = True

        async def get(self, url, **kwargs):
            result = await super().get(url, **kwargs)
            entered.set()
            await release.wait()
            assert not self.closed
            return result

    fake = ManagedClient(google=FakeResponse(GOOGLE_PAYLOAD))
    _, service = public_client(GOOGLE_ENV, fake)
    service.http_client = None
    monkeypatch.setattr(reviews.httpx, "AsyncClient", lambda **kwargs: fake)
    first = asyncio.create_task(service.get_snapshot())
    await entered.wait()
    second = asyncio.create_task(service.get_snapshot())
    await asyncio.sleep(0)
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    try:
        assert fake.closed is False
    finally:
        release.set()
        result = await second
    assert result["providers"][0]["id"] == "google"
    assert len(fake.calls) == 1
    assert fake.closed is True


@pytest.mark.asyncio
async def test_separate_service_instances_share_limits():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    _, first = public_client(GOOGLE_ENV, fake)
    second = ReviewsService(GOOGLE_ENV, http_client=fake, budget=MongoReviewBudget(
        first.budget.collection, first.budget.secret, clock=first.budget.clock,
    ))
    for i in range(10):
        service = first if i % 2 == 0 else second
        await service.get_snapshot(client_ip="192.0.2.1")
    with pytest.raises(ReviewBudgetError) as error:
        await second.get_snapshot(client_ip="192.0.2.1")
    assert error.value.status_code == 429
    assert len(fake.calls) == 10
    # A different client is independently eligible, while the global budget applies.
    await first.get_snapshot(client_ip="192.0.2.2")
    assert len(fake.calls) == 11


@pytest.mark.asyncio
async def test_private_health_uses_the_same_global_budget():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    _, service = public_client(GOOGLE_ENV, fake)
    service.budget.day_limit = 1
    await service.get_snapshot(client_ip="192.0.2.1")
    state = await service.integration_health()
    assert state["google"]["configured"] is True
    assert state["google"]["healthy"] is False
    assert len(fake.calls) == 1


def test_exhausted_google_budget_ignores_legacy_meta_configuration():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, service = public_client({**GOOGLE_ENV, **LEGACY_META_ENV}, fake)
    service.budget.day_limit = 1
    assert client.get("/api/reviews").status_code == 200
    second = client.get("/api/reviews")
    assert second.status_code == 429
    assert len(fake.calls) == 1


def test_missing_shared_guard_blocks_configured_provider_without_outbound_work():
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    service = ReviewsService(GOOGLE_ENV, http_client=fake)
    app = FastAPI()
    app.include_router(create_reviews_router(service))
    response = TestClient(app).get("/api/reviews")
    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store, private"
    assert fake.calls == []


def test_spoofed_forwarded_headers_do_not_rotate_client_budget(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    client, _ = public_client(GOOGLE_ENV, fake)
    responses = [client.get("/api/reviews", headers={"X-Forwarded-For": f"192.0.2.{i}"}) for i in range(11)]
    assert [response.status_code for response in responses] == [200] * 10 + [429]
    assert len(fake.calls) == 10


def test_provider_failures_back_off_without_reusing_google_content():
    clock = {"value": 100.0}
    fake = FakeAsyncClient(google=FakeResponse({}, status_code=429))
    client, _ = public_client(GOOGLE_ENV, fake, now=lambda: clock["value"])
    assert client.get("/api/reviews").json() == {"providers": []}
    limited = client.get("/api/reviews")
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "30"
    assert len(fake.calls) == 1
    clock["value"] += 30
    fake.google = FakeResponse(GOOGLE_PAYLOAD)
    assert client.get("/api/reviews").json()["providers"][0]["id"] == "google"
    assert len(fake.calls) == 2


@pytest.mark.asyncio
async def test_actual_server_composition_enforces_its_injected_shared_guard(server_loader):
    server = server_loader(**GOOGLE_ENV)
    fake = FakeAsyncClient(google=FakeResponse(GOOGLE_PAYLOAD))
    server.reviews_service.http_client = fake
    assert server.reviews_service.budget is server.reviews_budget
    assert server.reviews_budget.collection is None
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://fireart.test") as client:
        unavailable = await client.get("/api/reviews")
        assert unavailable.status_code == 503
        assert fake.calls == []
        server.reviews_budget.collection = MemoryCollection()
        responses = [await client.get("/api/reviews") for _ in range(11)]
        assert [response.status_code for response in responses] == [200] * 10 + [429]
        assert len(fake.calls) == 10
        server.reviews_budget.day_limit = 10
        health = await server.reviews_service.integration_health()
        assert health["google"]["healthy"] is False
        assert len(fake.calls) == 10
    await server.resend_http_client.aclose()


@pytest.mark.asyncio
async def test_provider_has_an_absolute_deadline_before_lease_can_expire(monkeypatch):
    import reviews
    cancelled = asyncio.Event()

    class HangingClient(FakeAsyncClient):
        async def get(self, url, **kwargs):
            await super().get(url, **kwargs)
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()

    fake = HangingClient()
    _, service = public_client(GOOGLE_ENV, fake)
    monkeypatch.setattr(reviews, "PROVIDER_TIMEOUT_SECONDS", 0.01)
    assert await asyncio.wait_for(service.get_snapshot(), 1) == {"providers": []}
    assert cancelled.is_set()
    assert len(fake.calls) == 1
    with pytest.raises(ReviewBudgetError):
        await service.get_snapshot()
    assert len(fake.calls) == 1
