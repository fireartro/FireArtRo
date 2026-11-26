"""Credential-gated Google Places reviews for FireArtRo."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Mapping, Optional
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from auth import request_ip
from review_budget import MongoReviewBudget, ReviewBudgetError


logger = logging.getLogger(__name__)

GOOGLE_FIELDS = "displayName,googleMapsUri,reviews"
PROVIDER_TIMEOUT_SECONDS = 5.0


def _clean_text(value) -> str:
    return " ".join(str(value or "").strip().split())


def _optional_rating(value) -> Optional[float]:
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None
    return rating if 0 < rating <= 5 else None


def _safe_google_url(value, *, photo=False) -> str:
    """Accept only HTTPS URLs Google documents for review attribution."""
    try:
        parsed = urlparse(_clean_text(value))
        port = parsed.port
    except ValueError:
        return ""
    host = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username
        or parsed.password
        or port
    ):
        return ""
    allowed = ("googleusercontent.com",) if photo else (
        "google.com", "googleusercontent.com", "goo.gl",
    )
    if not any(host == suffix or host.endswith(f".{suffix}") for suffix in allowed):
        return ""
    return parsed.geturl()


def _google_review(item: dict, index: int) -> Optional[dict]:
    text_value = item.get("text")
    text = _clean_text(text_value.get("text") if isinstance(text_value, dict) else text_value)
    if not text:
        return None

    attribution = item.get("authorAttribution") or {}
    review = {
        "id": _clean_text(item.get("name")) or f"google-{index}",
        "provider": "google",
        "author": _clean_text(attribution.get("displayName")),
        "text": text,
        "rating": _optional_rating(item.get("rating")),
        "published_at": _clean_text(item.get("publishTime")),
    }
    source_url = _safe_google_url(item.get("googleMapsUri"))
    author_url = _safe_google_url(attribution.get("uri"))
    photo_url = _safe_google_url(attribution.get("photoUri"), photo=True)
    relative_date = _clean_text(item.get("relativePublishTimeDescription"))
    original_value = item.get("originalText")
    original_text = _clean_text(original_value.get("text") if isinstance(original_value, dict) else original_value)
    if source_url:
        review["url"] = source_url
    if author_url:
        review["author_url"] = author_url
    if photo_url:
        review["author_photo_url"] = photo_url
    if relative_date:
        review["published_relative"] = relative_date
    if original_text:
        review["original_text"] = original_text
        review["translated"] = original_text != text
    return review


async def fetch_google_reviews(client, api_key: str, place_id: str) -> Optional[dict]:
    response = await client.get(
        f"https://places.googleapis.com/v1/places/{quote(place_id, safe='')}",
        headers={
            "Accept": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": GOOGLE_FIELDS,
        },
        params={"languageCode": "ro"},
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

    maps_uri = _safe_google_url(payload.get("googleMapsUri"))
    return {
        "id": "google",
        "href": maps_uri
        or f"https://www.google.com/maps/place/?q=place_id:{quote(place_id, safe='')}",
        "reviews": reviews,
    }


class ReviewsService:
    """Fetch sanitized Google reviews within the shared request budget."""

    def __init__(
        self,
        env: Mapping[str, str],
        http_client=None,
        budget=None,
    ):
        self.env = env
        self.http_client = http_client
        self._google_health = {}
        self.budget = budget if budget is not None else MongoReviewBudget(
            None, env.get("ADMIN_SESSION_SECRET", ""),
        )
        self._inflight = {}

    def _google_credentials(self):
        return (
            _clean_text(self.env.get("GOOGLE_PLACES_API_KEY")),
            _clean_text(self.env.get("GOOGLE_PLACE_ID")),
        )

    def _forget_inflight(self, key, task):
        if self._inflight.get(key) is task:
            del self._inflight[key]
        if not task.cancelled():
            task.exception()  # Also consume failures if every HTTP waiter left.

    async def _run_google(self, api_key, place_id, client_ip):
        token = await self.budget.reserve("google", client_ip)
        failed = True
        try:
            if self.http_client is not None:
                result = await asyncio.wait_for(
                    fetch_google_reviews(self.http_client, api_key, place_id),
                    timeout=PROVIDER_TIMEOUT_SECONDS,
                )
            else:
                # The task, not its first HTTP waiter, owns this client. Leaving
                # that request cannot close a connection another waiter uses.
                async with httpx.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS) as client:
                    result = await asyncio.wait_for(
                        fetch_google_reviews(client, api_key, place_id),
                        timeout=PROVIDER_TIMEOUT_SECONDS,
                    )
            failed = False
            return result
        finally:
            # A disconnected waiter must not cancel the shared provider task.
            # If storage fails here, the existing lease expires conservatively.
            try:
                await self.budget.complete("google", token, failed=failed)
            except ReviewBudgetError:
                logger.warning("Review provider budget completion unavailable")

    async def _google_result(self, api_key, place_id, client_ip):
        # Tasks belong to one runtime loop. Other loops/instances use the same
        # Mongo lease, rather than awaiting a foreign-loop future.
        key = asyncio.get_running_loop()
        task = self._inflight.get(key)
        if task is None or task.done():
            task = asyncio.create_task(self._run_google(api_key, place_id, client_ip))
            self._inflight[key] = task
            task.add_done_callback(lambda done: self._forget_inflight(key, done))
        return await asyncio.shield(task)

    async def get_snapshot(self, *, client_ip="internal") -> dict:
        api_key, place_id = self._google_credentials()
        if not (api_key and place_id):
            return {"providers": []}

        try:
            result = await self._google_result(api_key, place_id, client_ip)
        except Exception as error:
            logger.warning("Review provider google is unavailable")
            self._google_health = {
                "healthy": False,
                "checked_at": datetime.now(timezone.utc),
            }
            if isinstance(error, ReviewBudgetError):
                raise
            return {"providers": []}

        self._google_health = {
            "healthy": True,
            "checked_at": datetime.now(timezone.utc),
            "review_count": len(result["reviews"]) if result else 0,
        }
        return {"providers": [result] if result else []}

    async def integration_health(self) -> dict:
        configured = all(self._google_credentials())
        if configured:
            try:
                await self.get_snapshot()
            except ReviewBudgetError:
                pass  # Sanitized health metadata, never bypass the shared guard.
        health = self._google_health if configured else {}
        return {
            "google": {
                "configured": configured,
                "healthy": health.get("healthy"),
                "checked_at": health.get("checked_at"),
                "review_count": health.get("review_count"),
            },
        }


def create_reviews_router(service: ReviewsService) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/reviews")
    async def get_public_reviews(request: Request):
        return JSONResponse(
            content=await service.get_snapshot(client_ip=request_ip(request)),
            headers={"Cache-Control": "no-store, private"},
        )

    return router
