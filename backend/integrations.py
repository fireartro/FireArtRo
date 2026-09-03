"""Sanitized, session-protected integration health for the Admin workspace."""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Mapping

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from pymongo.errors import PyMongoError

from auth import require_admin_session


BLOB_ORIGIN = re.compile(r"https://[a-z0-9]+\.public\.blob\.vercel-storage\.com")


def utc_now():
    return datetime.now(timezone.utc)


def _present(value):
    return isinstance(value, str) and bool(value.strip())


class IntegrationState(BaseModel):
    configured: bool
    healthy: bool | None = None
    checked_at: datetime | None = None
    message: str = ""


class IntegrationsResponse(BaseModel):
    database: IntegrationState
    blob: IntegrationState
    google: IntegrationState
    facebook: IntegrationState


class IntegrationsService:
    """Checks only presence and provider reachability; it never serializes secrets."""

    def __init__(
        self,
        database,
        reviews_service,
        env: Mapping[str, str] | None = None,
        *,
        clock=utc_now,
        minimum_refresh_seconds=20,
    ):
        self.database = database
        self.reviews_service = reviews_service
        self.env = os.environ if env is None else env
        self.clock = clock
        self.minimum_refresh = timedelta(seconds=max(1, minimum_refresh_seconds))
        self._cached: IntegrationsResponse | None = None
        self._next_refresh_at: datetime | None = None

    def _blob_state(self):
        token = self.env.get("BLOB_READ_WRITE_TOKEN", "")
        origin = self.env.get("VERCEL_BLOB_MEDIA_ORIGIN", "")
        configured = bool(
            _present(token)
            and isinstance(origin, str)
            and BLOB_ORIGIN.fullmatch(origin)
        )
        return IntegrationState(
            configured=configured,
            healthy=None,
            message="" if configured else "Necesită configurare.",
        )

    async def _database_state(self, checked_at):
        if self.database is None:
            return IntegrationState(configured=False, message="Necesită configurare.")
        try:
            await asyncio.wait_for(self.database.command("ping"), timeout=2)
            return IntegrationState(configured=True, healthy=True, checked_at=checked_at)
        except (PyMongoError, TimeoutError, asyncio.TimeoutError, OSError):
            return IntegrationState(
                configured=True,
                healthy=False,
                checked_at=checked_at,
                message="Baza de date nu răspunde momentan.",
            )

    async def _review_states(self, refresh):
        fallback = {
            "google": IntegrationState(
                configured=bool(_present(self.env.get("GOOGLE_PLACES_API_KEY", "")) and _present(self.env.get("GOOGLE_PLACE_ID", ""))),
                message="Necesită configurare.",
            ),
            "facebook": IntegrationState(
                configured=bool(_present(self.env.get("META_PAGE_ID", "")) and _present(self.env.get("META_PAGE_ACCESS_TOKEN", ""))),
                message="Necesită configurare.",
            ),
        }
        for state in fallback.values():
            if state.configured:
                state.message = "Configurat"
        if self.reviews_service is None:
            return fallback
        try:
            source = await self.reviews_service.integration_health(refresh=refresh)
        except Exception:
            # Provider failure is intentionally summarized; response text must never leak URLs/tokens.
            source = {}
        result = {}
        for provider, default in fallback.items():
            value = source.get(provider) if isinstance(source, dict) else None
            if not isinstance(value, dict):
                result[provider] = default
                continue
            configured = default.configured and bool(value.get("configured"))
            healthy = value.get("healthy") if configured and isinstance(value.get("healthy"), bool) else None
            checked_at = value.get("checked_at") if configured and isinstance(value.get("checked_at"), datetime) else None
            result[provider] = IntegrationState(
                configured=configured,
                healthy=healthy,
                checked_at=checked_at,
                message=("" if healthy is True else "Eroare temporară" if healthy is False
                         else "Configurat" if configured else "Necesită configurare."),
            )
        return result

    async def status(self, *, refresh=False):
        now = self.clock()
        if self._cached is not None and self._next_refresh_at is not None and now < self._next_refresh_at:
            return self._cached
        checked_at = now
        reviews = await self._review_states(refresh)
        self._cached = IntegrationsResponse(
            database=await self._database_state(checked_at),
            blob=self._blob_state(),
            google=reviews["google"],
            facebook=reviews["facebook"],
        )
        self._next_refresh_at = now + self.minimum_refresh
        return self._cached


def create_integrations_router(service: IntegrationsService):
    router = APIRouter(prefix="/api/admin", tags=["admin-integrations"])

    @router.get("/integrations", response_model=IntegrationsResponse)
    async def integrations(
        response: Response,
        refresh: bool = Query(default=False),
        _=Depends(require_admin_session),
    ):
        response.headers["Cache-Control"] = "no-store"
        return await service.status(refresh=refresh)

    return router
