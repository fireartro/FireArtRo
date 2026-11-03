"""Shared, bounded provider-attempt budgets; no review content is stored."""

import asyncio
import hashlib
import hmac
import math
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError, PyMongoError


MINUTE = timedelta(minutes=1)
DAY = timedelta(days=1)
LEASE = timedelta(seconds=15)
FAILURE_BACKOFF = timedelta(seconds=30)


def _utc(value):
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


class ReviewBudgetError(HTTPException):
    def __init__(self, status_code=429, retry_after=1):
        super().__init__(
            status_code,
            "Recenziile nu sunt disponibile momentan. Încearcă din nou mai târziu.",
            headers={
                "Cache-Control": "no-store, private",
                "Retry-After": str(max(1, math.ceil(retry_after))),
            },
        )


class MongoReviewBudget:
    """One CAS document per provider bounds both work and stored client state.

    The unique _id and random revision handle first-insert and TTL/ABA races.
    Expiries are checked in code; TTL is cleanup, never an authorization check.
    Pending/failed attempts consume quota, including crashed provider workers.
    """

    def __init__(
        self,
        collection,
        secret,
        *,
        clock=lambda: datetime.now(timezone.utc),
        client_limit=10,
        minute_limit=60,
        day_limit=1000,
    ):
        self.collection, self.secret, self.clock = collection, secret, clock
        self.client_limit = client_limit
        self.minute_limit = minute_limit
        self.day_limit = day_limit

    async def create_indexes(self):
        if self.collection is None:
            raise ReviewBudgetError(503, 30)
        await self.collection.create_index("expires_at", expireAfterSeconds=0)

    async def _save(self, provider, previous, entries, lease, retry_at, now):
        document = {
            "_id": provider,
            "revision": secrets.token_hex(16),
            "entries": entries,
            "lease": lease,
            "retry_at": retry_at,
            "expires_at": max(
                [now + LEASE, *(_utc(entry["at"]) + DAY for entry in entries)],
            ),
        }
        if previous is None:
            try:
                await self.collection.insert_one(document)
                return True
            except DuplicateKeyError:
                return False
        result = await self.collection.replace_one(
            {"_id": provider, "revision": previous["revision"]},
            document,
        )
        return result.matched_count == 1

    async def reserve(self, provider, client_ip):
        if (
            self.collection is None
            or not isinstance(self.secret, str)
            or len(self.secret.encode()) < 32
        ):
            raise ReviewBudgetError(503, 30)
        if provider not in {"google", "facebook"}:
            raise ReviewBudgetError(503, 30)
        digest = hmac.new(
            self.secret.encode(),
            f"review-budget:{str(client_ip)[:255]}".encode(),
            hashlib.sha256,
        ).hexdigest()
        try:
            return await asyncio.wait_for(self._reserve(provider, digest), timeout=2)
        except (PyMongoError, asyncio.TimeoutError):
            raise ReviewBudgetError(503, 30) from None

    async def _reserve(self, provider, digest):
        for _ in range(32):
            now = _utc(self.clock())
            previous = await self.collection.find_one({"_id": provider})
            entries = (
                [
                    entry
                    for entry in previous["entries"]
                    if _utc(entry["at"]) + DAY > now
                ]
                if previous
                else []
            )
            retry_at = previous.get("retry_at") if previous else None
            lease = previous.get("lease") if previous else None
            if retry_at is not None and _utc(retry_at) > now:
                raise ReviewBudgetError(
                    retry_after=(_utc(retry_at) - now).total_seconds()
                )
            if lease is not None and _utc(lease["expires_at"]) > now:
                raise ReviewBudgetError(
                    retry_after=(_utc(lease["expires_at"]) - now).total_seconds()
                )
            recent = [entry for entry in entries if _utc(entry["at"]) + MINUTE > now]
            client = [entry for entry in recent if entry["client"] == digest]
            for bucket, limit, window in (
                (client, self.client_limit, MINUTE),
                (recent, self.minute_limit, MINUTE),
                (entries, self.day_limit, DAY),
            ):
                if len(bucket) >= limit:
                    retry = min(_utc(entry["at"]) + window for entry in bucket) - now
                    raise ReviewBudgetError(retry_after=retry.total_seconds())
            token = secrets.token_hex(16)
            entries.append({"at": now, "client": digest})
            if await self._save(
                provider,
                previous,
                entries,
                {"token": token, "expires_at": now + LEASE},
                None,
                now,
            ):
                return token
        raise ReviewBudgetError(503, 30)

    async def complete(self, provider, token, *, failed=False):
        try:
            await asyncio.wait_for(
                self._complete(provider, token, failed=failed), timeout=2
            )
        except (PyMongoError, asyncio.TimeoutError):
            raise ReviewBudgetError(503, 30) from None

    async def _complete(self, provider, token, *, failed):
        for _ in range(32):
            previous = await self.collection.find_one({"_id": provider})
            lease = previous.get("lease") if previous else None
            if lease is None or lease["token"] != token:
                return  # A stale/cancelled worker cannot release a replacement.
            now = _utc(self.clock())
            retry_at = now + FAILURE_BACKOFF if failed else None
            if await self._save(
                provider, previous, previous["entries"], None, retry_at, now
            ):
                return
        raise ReviewBudgetError(503, 30)
