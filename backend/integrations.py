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
GA_MEASUREMENT_ID = re.compile(r"G-[A-Z0-9]+")


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
    resend: IntegrationState
    turnstile: IntegrationState
    analytics: IntegrationState
    google: IntegrationState


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

    def _resend_state(self):
        configured = (
            self.env.get("RESEND_ENABLED") == "true"
            and all(
                _present(self.env.get(name, ""))
                for name in (
                    "RESEND_API_KEY",
                    "RESEND_WEBHOOK_SECRET",
                    "RESEND_FROM_EMAIL",
                    "RESEND_NOTIFICATION_TO",
                    "RESEND_INBOUND_DOMAIN",
                    "RESEND_INBOUND_ADDRESS",
                )
            )
        )
        return IntegrationState(
            configured=configured,
            healthy=None,
            message="Configurat" if configured else "Necesită configurare.",
        )

    def _turnstile_state(self):
        enabled = self.env.get("TURNSTILE_ENABLED")
        if enabled == "false":
            return IntegrationState(
                configured=False,
                healthy=None,
                message="Dezactivat",
            )
        configured = (
            enabled == "true"
            and _present(self.env.get("TURNSTILE_SECRET_KEY", ""))
            and _present(self.env.get("REACT_APP_TURNSTILE_SITE_KEY", ""))
        )
        return IntegrationState(
            configured=configured,
            healthy=None,
            message="Configurat" if configured else "Necesită configurare.",
        )

    def _analytics_state(self):
        measurement_id = self.env.get("REACT_APP_GA_MEASUREMENT_ID", "")
        configured = bool(
            isinstance(measurement_id, str)
            and GA_MEASUREMENT_ID.fullmatch(measurement_id.strip())
        )
        return IntegrationState(
            configured=configured,
            healthy=None,
            message="Configurat" if configured else "Necesită configurare.",
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

    async def _google_state(self):
        missing = [
            name for name in ("GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID")
            if not _present(self.env.get(name, ""))
        ]
        if missing:
            verb = "Lipsește" if len(missing) == 1 else "Lipsesc"
            return IntegrationState(
                configured=False, message=f"{verb} {', '.join(missing)} în Vercel.",
            )
        fallback = IntegrationState(configured=True, message="Configurat")
        if self.reviews_service is None:
            return fallback
        try:
            source = await self.reviews_service.integration_health()
        except Exception:
            # Provider failure is intentionally summarized; response text must never leak URLs/tokens.
            return fallback
        value = source.get("google") if isinstance(source, dict) else None
        if not isinstance(value, dict):
            return fallback
        configured = bool(value.get("configured"))
        healthy = value.get("healthy") if configured and isinstance(value.get("healthy"), bool) else None
        checked_at = value.get("checked_at") if configured and isinstance(value.get("checked_at"), datetime) else None
        message = fallback.message
        if healthy is True:
            message = "Conectat, fără recenzii cu text disponibile." if value.get("review_count") == 0 else ""
        elif healthy is False:
            message = "Furnizorul nu răspunde. Verifică accesul API, permisiunile și cotele."
        return IntegrationState(
            configured=configured,
            healthy=healthy,
            checked_at=checked_at,
            message=message,
        )

    async def status(self):
        now = self.clock()
        if self._cached is not None and self._next_refresh_at is not None and now < self._next_refresh_at:
            return self._cached
        checked_at = now
        google = await self._google_state()
        self._cached = IntegrationsResponse(
            database=await self._database_state(checked_at),
            blob=self._blob_state(),
            resend=self._resend_state(),
            turnstile=self._turnstile_state(),
            analytics=self._analytics_state(),
            google=google,
        )
        self._next_refresh_at = now + self.minimum_refresh
        return self._cached


def create_integrations_router(service: IntegrationsService):
    router = APIRouter(prefix="/api/admin", tags=["admin-integrations"])

    @router.get("/integrations", response_model=IntegrationsResponse)
    async def integrations(
        response: Response,
        _refresh: bool = Query(default=False, alias="refresh"),
        _=Depends(require_admin_session),
    ):
        response.headers["Cache-Control"] = "no-store"
        return await service.status()

    return router
