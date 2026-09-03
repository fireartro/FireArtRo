"""Credential-gated provider adapters for public FireArtRo reviews."""

import asyncio
import logging
from time import monotonic
from datetime import datetime, timezone
from typing import Mapping, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter


logger = logging.getLogger(__name__)

GOOGLE_FIELDS = "displayName,googleMapsUri,reviews"
META_DEFAULT_API_VERSION = "v23.0"
PROVIDER_TIMEOUT_SECONDS = 5.0


def _clean_text(value) -> str:
    return " ".join(str(value or "").strip().split())


def _optional_rating(value) -> Optional[float]:
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None
    return rating if 0 < rating <= 5 else None


def _google_review(item: dict, index: int) -> Optional[dict]:
    text_value = item.get("text")
    text = _clean_text(text_value.get("text") if isinstance(text_value, dict) else text_value)
    if not text:
        return None

    attribution = item.get("authorAttribution") or {}
    return {
        "id": _clean_text(item.get("name")) or f"google-{index}",
        "provider": "google",
        "author": _clean_text(attribution.get("displayName")),
        "text": text,
        "rating": _optional_rating(item.get("rating")),
        "published_at": _clean_text(item.get("publishTime")),
        "url": _clean_text(item.get("googleMapsUri") or attribution.get("uri")),
    }


def _facebook_review(item: dict, index: int) -> Optional[dict]:
    text = _clean_text(item.get("review_text"))
    if not text:
        return None

    reviewer = item.get("reviewer") or {}
    return {
        "id": _clean_text(item.get("id")) or f"facebook-{index}",
        "provider": "facebook",
        "author": _clean_text(reviewer.get("name")),
        "text": text,
        "rating": _optional_rating(item.get("rating")),
        "published_at": _clean_text(item.get("created_time")),
        "url": _clean_text(item.get("url")),
    }


async def fetch_google_reviews(client, api_key: str, place_id: str) -> Optional[dict]:
    response = await client.get(
        f"https://places.googleapis.com/v1/places/{quote(place_id, safe='')}",
        headers={
            "Accept": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": GOOGLE_FIELDS,
        },
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return None

    reviews = [
        normalized
        for index, item in enumerate(payload.get("reviews") or [])
        if isinstance(item, dict)
        for normalized in [_google_review(item, index)]
        if normalized
    ]
    if not reviews:
        return None

    return {
        "id": "google",
        "href": _clean_text(payload.get("googleMapsUri"))
        or f"https://www.google.com/maps/place/?q=place_id:{quote(place_id, safe='')}",
        "reviews": reviews,
    }


async def fetch_facebook_reviews(
    client,
    page_id: str,
    access_token: str,
    api_version: str,
) -> Optional[dict]:
    version = _clean_text(api_version) or META_DEFAULT_API_VERSION
    response = await client.get(
        f"https://graph.facebook.com/{quote(version, safe='.')}/{quote(page_id, safe='')}/ratings",
        params={
            "access_token": access_token,
            "fields": "id,rating,review_text,created_time,reviewer",
            "limit": 25,
        },
        headers={"Accept": "application/json"},
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return None

    reviews = [
        normalized
        for index, item in enumerate(payload.get("data") or [])
        if isinstance(item, dict)
        for normalized in [_facebook_review(item, index)]
        if normalized
    ]
    if not reviews:
        return None

    return {
        "id": "facebook",
        "href": f"https://www.facebook.com/{quote(page_id, safe='')}/reviews",
        "reviews": reviews,
    }


class ReviewsService:
    """Fetch and cache sanitized provider data without exposing credentials."""

    def __init__(
        self,
        env: Mapping[str, str],
        http_client=None,
        ttl_seconds: int = 900,
        now=monotonic,
    ):
        self.env = env
        self.http_client = http_client
        self.ttl_seconds = max(0, ttl_seconds)
        self.now = now
        self._cached_snapshot = None
        self._cache_expires_at = 0.0
        self._provider_health = {}

    def _provider_jobs(self, client):
        jobs = []

        google_key = _clean_text(self.env.get("GOOGLE_PLACES_API_KEY"))
        google_place_id = _clean_text(self.env.get("GOOGLE_PLACE_ID"))
        if google_key and google_place_id:
            jobs.append((
                "google",
                fetch_google_reviews(client, google_key, google_place_id),
            ))

        meta_page_id = _clean_text(self.env.get("META_PAGE_ID"))
        meta_token = _clean_text(self.env.get("META_PAGE_ACCESS_TOKEN"))
        if meta_page_id and meta_token:
            jobs.append((
                "facebook",
                fetch_facebook_reviews(
                    client,
                    meta_page_id,
                    meta_token,
                    self.env.get("META_GRAPH_API_VERSION", META_DEFAULT_API_VERSION),
                ),
            ))

        return jobs

    async def _fetch_snapshot(self, client) -> dict:
        jobs = self._provider_jobs(client)
        if not jobs:
            return {"providers": []}

        results = await asyncio.gather(
            *(job for _, job in jobs),
            return_exceptions=True,
        )
        providers = []
        checked_at = datetime.now(timezone.utc)
        for (provider_id, _), result in zip(jobs, results):
            if isinstance(result, Exception):
                logger.warning("Review provider %s is unavailable", provider_id)
                self._provider_health[provider_id] = {"healthy": False, "checked_at": checked_at}
                continue
            self._provider_health[provider_id] = {"healthy": True, "checked_at": checked_at}
            if result:
                providers.append(result)
        return {"providers": providers}

    async def get_snapshot(self, *, force=False) -> dict:
        now_value = self.now()
        if not force and self._cached_snapshot is not None and now_value < self._cache_expires_at:
            return self._cached_snapshot

        if self.http_client is not None:
            snapshot = await self._fetch_snapshot(self.http_client)
        else:
            async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS) as client:
                snapshot = await self._fetch_snapshot(client)

        self._cached_snapshot = snapshot
        self._cache_expires_at = now_value + self.ttl_seconds
        return snapshot

    async def integration_health(self, *, refresh=False) -> dict:
        configured = {
            "google": bool(_clean_text(self.env.get("GOOGLE_PLACES_API_KEY")) and _clean_text(self.env.get("GOOGLE_PLACE_ID"))),
            "facebook": bool(_clean_text(self.env.get("META_PAGE_ID")) and _clean_text(self.env.get("META_PAGE_ACCESS_TOKEN"))),
        }
        if any(configured.values()):
            await self.get_snapshot(force=refresh)
        return {
            provider: {
                "configured": is_configured,
                "healthy": self._provider_health.get(provider, {}).get("healthy") if is_configured else None,
                "checked_at": self._provider_health.get(provider, {}).get("checked_at") if is_configured else None,
            }
            for provider, is_configured in configured.items()
        }


def create_reviews_router(service: ReviewsService) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/reviews")
    async def get_public_reviews():
        return await service.get_snapshot()

    return router
