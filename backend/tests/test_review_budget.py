"""Provider budget contracts with atomic Mongo-shaped storage, no network."""

import asyncio
from copy import deepcopy
from datetime import timedelta

import pytest
from pymongo.errors import AutoReconnect

from review_budget import MongoReviewBudget, ReviewBudgetError
from test_auth import Clock, MemoryCollection


SECRET = "review-budget-test-secret-at-least-32-bytes"


def guard(collection=None, clock=None, **limits):
    return MongoReviewBudget(
        MemoryCollection() if collection is None else collection,
        SECRET,
        clock=clock or Clock(),
        **limits,
    )


@pytest.mark.asyncio
async def test_shared_minute_and_day_limits_stop_different_clients_before_work():
    collection, clock = MemoryCollection(), Clock()
    first = guard(collection, clock, minute_limit=2, day_limit=3)
    second = guard(collection, clock, minute_limit=2, day_limit=3)
    for service, ip in [(first, "192.0.2.1"), (second, "192.0.2.2")]:
        token = await service.reserve("google", ip)
        await service.complete("google", token)
    with pytest.raises(ReviewBudgetError) as error:
        await second.reserve("google", "192.0.2.3")
    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"] == "60"
    clock.now += timedelta(seconds=60)
    token = await second.reserve("google", "192.0.2.3")
    await second.complete("google", token)
    with pytest.raises(ReviewBudgetError) as error:
        await first.reserve("google", "192.0.2.4")
    assert int(error.value.headers["Retry-After"]) == 86_340
    clock.now += timedelta(days=1)
    assert await first.reserve("google", "192.0.2.4")
    assert len(collection.documents) == 1  # No dependency on TTL deletion.
    assert len(collection.documents[0]["entries"]) == 1


@pytest.mark.asyncio
async def test_concurrent_guards_cannot_both_acquire_the_shared_provider_lease():
    collection, clock = MemoryCollection(), Clock()
    guards = [guard(collection, clock) for _ in range(24)]
    outcomes = await asyncio.gather(
        *[item.reserve("google", f"192.0.2.{i}") for i, item in enumerate(guards)],
        return_exceptions=True,
    )
    assert sum(isinstance(value, str) for value in outcomes) == 1
    assert all(
        isinstance(value, str)
        or (isinstance(value, ReviewBudgetError) and value.status_code == 429)
        for value in outcomes
    )
    assert len(collection.documents) == 1
    assert len(collection.documents[0]["entries"]) == 1


@pytest.mark.asyncio
async def test_expired_lease_recovers_but_stale_owner_cannot_release_replacement():
    clock = Clock()
    budget = guard(clock=clock)
    old = await budget.reserve("google", "192.0.2.1")
    clock.now += timedelta(seconds=15)
    replacement = await budget.reserve("google", "192.0.2.2")
    await budget.complete("google", old, failed=True)
    assert budget.collection.documents[0]["lease"]["token"] == replacement
    assert budget.collection.documents[0]["retry_at"] is None
    with pytest.raises(ReviewBudgetError):
        await budget.reserve("google", "192.0.2.3")
    await budget.complete("google", replacement)
    assert await budget.reserve("google", "192.0.2.3")


@pytest.mark.asyncio
async def test_client_identifiers_are_domain_separated_hmacs_and_storage_is_bounded():
    budget = guard(day_limit=3)
    for ip in ["192.0.2.1", "192.0.2.2", "192.0.2.3"]:
        token = await budget.reserve("google", ip)
        await budget.complete("google", token)
    before = deepcopy(budget.collection.documents)
    for i in range(100):
        with pytest.raises(ReviewBudgetError):
            await budget.reserve("google", f"198.51.100.{i}")
    assert budget.collection.documents == before
    assert "192.0.2." not in repr(before)
    assert all(len(entry["client"]) == 64 for entry in before[0]["entries"])
    assert "reviews" not in before[0]
    assert before[0]["expires_at"] > before[0]["entries"][-1]["at"]


@pytest.mark.asyncio
async def test_bson_naive_dates_and_concurrent_duplicate_completion_remain_safe():
    budget = guard()
    token = await budget.reserve("google", "192.0.2.1")
    document = budget.collection.documents[0]
    document["entries"][0]["at"] = document["entries"][0]["at"].replace(tzinfo=None)
    document["lease"]["expires_at"] = document["lease"]["expires_at"].replace(
        tzinfo=None
    )
    await asyncio.gather(
        budget.complete("google", token), budget.complete("google", token)
    )
    assert len(document["entries"]) == 1
    assert await budget.reserve("google", "192.0.2.2")


@pytest.mark.asyncio
async def test_provider_failures_have_shared_backoff_without_clearing_consumed_quota():
    clock, collection = Clock(), MemoryCollection()
    first, second = guard(collection, clock), guard(collection, clock)
    token = await first.reserve("google", "192.0.2.1")
    await first.complete("google", token, failed=True)
    with pytest.raises(ReviewBudgetError) as error:
        await second.reserve("google", "192.0.2.2")
    assert error.value.headers["Retry-After"] == "30"
    clock.now += timedelta(seconds=30)
    assert await second.reserve("google", "192.0.2.2")
    assert len(collection.documents[0]["entries"]) == 2


@pytest.mark.asyncio
async def test_missing_storage_or_secret_and_database_errors_fail_closed():
    for budget in [
        MongoReviewBudget(None, SECRET),
        MongoReviewBudget(MemoryCollection(), "short"),
    ]:
        with pytest.raises(ReviewBudgetError) as error:
            await budget.reserve("google", "192.0.2.1")
        assert error.value.status_code == 503

    class FailedCollection(MemoryCollection):
        async def find_one(self, query):
            raise AutoReconnect("mongodb://private:credential@internal.invalid")

    with pytest.raises(ReviewBudgetError) as error:
        await guard(FailedCollection()).reserve("google", "192.0.2.1")
    assert error.value.status_code == 503
    assert "credential" not in str(error.value.detail)


@pytest.mark.asyncio
async def test_unknown_provider_does_not_create_arbitrary_budget_documents():
    budget = guard()
    with pytest.raises(ReviewBudgetError):
        await budget.reserve("attacker-selected-provider", "192.0.2.1")
    assert budget.collection.documents == []


@pytest.mark.asyncio
async def test_budget_index_is_only_ttl_cleanup_and_does_not_require_extra_uniqueness():
    class IndexedCollection(MemoryCollection):
        async def create_index(self, field, **options):
            assert field == "expires_at"
            assert options == {"expireAfterSeconds": 0}
            return "expires_at_1"

    await guard(IndexedCollection()).create_indexes()
    with pytest.raises(ReviewBudgetError) as error:
        await MongoReviewBudget(None, SECRET).create_indexes()
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_failed_release_retains_the_conservative_lease_until_expiry():
    class UnavailableReleaseCollection(MemoryCollection):
        unavailable = False

        async def find_one(self, query):
            if self.unavailable:
                raise AutoReconnect("synthetic unavailable storage")
            return await super().find_one(query)

    collection, clock = UnavailableReleaseCollection(), Clock()
    budget = guard(collection, clock)
    token = await budget.reserve("google", "192.0.2.1")
    collection.unavailable = True
    with pytest.raises(ReviewBudgetError):
        await budget.complete("google", token)
    collection.unavailable = False
    with pytest.raises(ReviewBudgetError) as error:
        await budget.reserve("google", "192.0.2.2")
    assert error.value.status_code == 429
    clock.now += timedelta(seconds=15)
    assert await budget.reserve("google", "192.0.2.2")


@pytest.mark.asyncio
async def test_ttl_recreation_cannot_make_an_old_revision_match_a_new_document():
    budget = guard()
    old_token = await budget.reserve("google", "192.0.2.1")
    old = deepcopy(budget.collection.documents[0])
    budget.collection.documents.clear()  # Model cleanup of a genuinely expired row.
    new_token = await budget.reserve("google", "192.0.2.2")
    current = deepcopy(budget.collection.documents[0])
    assert current["revision"] != old["revision"]
    assert new_token != old_token
    await budget.complete("google", old_token, failed=True)
    assert budget.collection.documents[0] == current
