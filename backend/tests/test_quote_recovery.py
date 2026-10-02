"""Durable quote acknowledgement, retry identity and notification recovery."""

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pymongo.errors import AutoReconnect, DuplicateKeyError

from test_quotes import public_server, api_client, valid_payload, FakeTurnstileVerifier
from test_quote_admin import quote, authorize
from test_cms_routes import RouteAuthService

SUBMISSION = "d5343611-3f84-40f9-a0b2-7eb1d19f0796"
NOW = datetime(2026, 10, 2, 12, tzinfo=timezone.utc)


@pytest.mark.asyncio
@pytest.mark.parametrize("stage", ["create_or_get", "mark_sent", "mark_failed"])
async def test_delivery_bookkeeping_failure_never_revokes_stored_ack(public_server, stage, monkeypatch, caplog):
    from quote_admin import QuoteNotificationService
    from test_quotes import FakeNotificationDeliveryRepository, FakeResendClient
    from resend_email import ResendError

    server, collection, _ = public_server
    deliveries = FakeNotificationDeliveryRepository()
    sender = FakeResendClient(collection.events, failure=ResendError("provider_unavailable") if stage == "mark_failed" else None)

    async def unavailable(*args, **kwargs):
        raise AutoReconnect("mongodb://private:do-not-log@example.invalid")

    monkeypatch.setattr(deliveries, stage, unavailable)
    server.quote_notification_service = QuoteNotificationService(sender, deliveries)
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload())
    assert response.status_code == 200
    assert response.json() == {"accepted": True}
    assert len(collection.documents) == 1
    assert "do-not-log" not in response.text + caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [
    {"first_name": "  "}, {"last_name": " x "}, {"phone": "       "},
    {"locality": "  "}, {"event_type": "  "}, {"services": ["   "]},
    {"event_date": "not-a-date"}, {"event_date": "2027-02-30"},
    {"event_date": "2027-2-03"}, {"event_date": "2027-W02-1"},
])
async def test_invalid_normalized_customer_data_never_persists(public_server, changes):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(**changes))
    assert response.status_code == 422
    assert collection.documents == []


@pytest.mark.asyncio
@pytest.mark.parametrize("length", [120, 121, 160, 161])
async def test_package_title_matches_cms_boundary(public_server, length):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(package_title="x" * length))
    assert response.status_code == (200 if length <= 160 else 422)
    assert len(collection.documents) == (1 if length <= 160 else 0)


@pytest.mark.asyncio
async def test_trim_runs_before_max_length_and_valid_leap_day_is_accepted(public_server):
    server, collection, _ = public_server
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(first_name="  " + "a" * 80 + "  ", event_date="2028-02-29", services=[" Drone ", "Drone"]))
    assert response.status_code == 200
    assert collection.documents[0]["first_name"] == "a" * 80
    assert collection.documents[0]["services"] == ["Drone"]


@pytest.mark.asyncio
async def test_same_submission_is_durable_across_retry_and_verifier_token_refresh(public_server):
    server, collection, _ = public_server
    verifier = FakeTurnstileVerifier()
    server.turnstile_verifier = verifier
    async with api_client(server) as client:
        first = await client.post("/api/quotes", json=valid_payload(submission_id=SUBMISSION, turnstile_token="first"))
        second = await client.post("/api/quotes", json=valid_payload(submission_id=SUBMISSION.upper(), turnstile_token="fresh", first_name=" Popescu "))
    assert first.json() == second.json() == {"accepted": True}
    assert first.status_code == second.status_code == 200
    assert len(collection.documents) == 1
    assert len(verifier.calls) == 1


@pytest.mark.asyncio
async def test_reusing_submission_for_different_customer_data_conflicts(public_server):
    server, collection, _ = public_server
    async with api_client(server) as client:
        await client.post("/api/quotes", json=valid_payload(submission_id=SUBMISSION))
        response = await client.post("/api/quotes", json=valid_payload(submission_id=SUBMISSION, message="private changed content"))
    assert response.status_code == 409
    assert len(collection.documents) == 1
    assert "private changed content" not in response.text


@pytest.mark.asyncio
async def test_racing_submissions_use_atomic_durable_identity(public_server, monkeypatch):
    server, collection, _ = public_server
    original = collection.insert_one

    async def raced(document):
        await asyncio.sleep(0)
        return await original(document)

    monkeypatch.setattr(collection, "insert_one", raced)
    async with api_client(server) as client:
        responses = await asyncio.gather(*(client.post("/api/quotes", json=valid_payload(submission_id=SUBMISSION)) for _ in range(8)))
    assert [r.status_code for r in responses] == [200] * 8
    assert len(collection.documents) == 1
    assert collection.documents[0]["_id"] == f"quote-submission/{SUBMISSION}"


@pytest.mark.asyncio
async def test_exhausted_attempt_budget_prevents_siteverify(public_server):
    server, collection, _ = public_server
    verifier = FakeTurnstileVerifier()
    server.turnstile_verifier = verifier

    class Exhausted:
        async def enforce(self, ip):
            raise HTTPException(429, "Prea multe solicitări.")

    server.quote_rate_limiter = Exhausted()
    async with api_client(server) as client:
        response = await client.post("/api/quotes", json=valid_payload(turnstile_token="private-token"))
    assert response.status_code == 429
    assert verifier.calls == []
    assert collection.documents == []


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, branch) for branch in expected): return False
        elif key == "$and":
            if not all(matches(document, branch) for branch in expected): return False
        elif isinstance(expected, dict):
            for operator, value in expected.items():
                actual = document.get(key)
                if operator == "$exists":
                    if (key in document) != value: return False
                elif operator == "$lte":
                    if actual is None or actual > value: return False
                elif operator == "$gt":
                    if actual is None or actual <= value: return False
                elif operator == "$in":
                    if actual not in value: return False
                else: raise AssertionError(operator)
        elif document.get(key) != expected: return False
    return True


class DeliveryCollection:
    """Atomic Mongo boundary double; yields before operations, never during CAS."""
    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))

    async def find_one(self, query, projection=None, **kwargs):
        await asyncio.sleep(0)
        return self.project(next((d for d in self.documents if matches(d, query)), None), projection)

    @staticmethod
    def project(document, projection):
        if document is None: return None
        return deepcopy({k: v for k, v in document.items() if projection is None or projection.get(k) == 1})

    async def insert_one(self, document):
        await asyncio.sleep(0)
        if any(d["idempotency_key"] == document["idempotency_key"] for d in self.documents):
            raise DuplicateKeyError("durable notification identity")
        self.documents.append(deepcopy(document))

    async def find_one_and_update(self, query, update, *, projection=None, **kwargs):
        await asyncio.sleep(0)
        document = next((d for d in self.documents if matches(d, query)), None)
        if document is None: return None
        document.update(deepcopy(update.get("$set", {})))
        for key in update.get("$unset", {}): document.pop(key, None)
        return self.project(document, projection)


def pending(age=timedelta(minutes=3), **changes):
    return {
        "id": "delivery-q1", "kind": "quote_notification", "state": "pending",
        "idempotency_key": "quote-notification/q1", "related_quote_id": "q1",
        "recipient": "fireartro@gmail.com", "created_at": NOW - age,
        "updated_at": NOW - age, "error_code": None, "sent_at": None,
        "first_attempt_at": NOW - age, "lease_token": "previous-worker",
        "lease_expires_at": NOW - age + timedelta(minutes=2), **changes,
    }


def leased_domain(documents=(), sender=None):
    import quote_admin
    # RED is a missing atomic lease API, expressed as an assertion rather than import failure.
    assert hasattr(quote_admin, "MongoQuoteDeliveryRepository"), "Durable notification leases are missing"
    collection = DeliveryCollection(documents)
    repository = quote_admin.MongoQuoteDeliveryRepository(collection, clock=lambda: NOW)

    class Sender:
        def __init__(self): self.calls = []
        async def send(self, **kwargs):
            self.calls.append(kwargs)
            await asyncio.sleep(0)
            return "accepted-provider-id"

    sender = sender or Sender()
    return collection, repository, quote_admin.QuoteNotificationService(sender, repository), sender


@pytest.mark.asyncio
async def test_expired_pending_is_reclaimed_once_by_competing_workers():
    collection, repository, service, sender = leased_domain([pending()])
    from quote_admin import QuoteNotificationService
    other = QuoteNotificationService(sender, repository)
    await asyncio.gather(service.retry(quote()), other.retry(quote()), return_exceptions=True)
    assert len(sender.calls) == 1
    assert sender.calls[0]["idempotency_key"] == "quote-notification/q1"
    assert collection.documents[0]["state"] == "sent"


@pytest.mark.asyncio
async def test_active_pending_lease_cannot_be_retried_even_through_service():
    collection, _, service, sender = leased_domain([pending(age=timedelta(seconds=10))])
    with pytest.raises(HTTPException) as error:
        await service.retry(quote())
    assert error.value.status_code == 409
    assert sender.calls == []
    assert collection.documents[0]["lease_token"] == "previous-worker"


@pytest.mark.asyncio
async def test_unknown_outcome_past_provider_window_requires_reconciliation():
    _, _, service, sender = leased_domain([pending(age=timedelta(days=2))])
    with pytest.raises(HTTPException) as error:
        await service.retry(quote())
    assert error.value.status_code == 409
    assert sender.calls == []


@pytest.mark.asyncio
async def test_interrupted_attempt_leaves_recoverable_lease():
    class Interrupted:
        async def send(self, **kwargs): raise asyncio.CancelledError()

    collection, repository, service, _ = leased_domain(sender=Interrupted())
    with pytest.raises(asyncio.CancelledError):
        await service.notify(quote())
    assert collection.documents[0]["state"] == "pending"
    assert collection.documents[0]["lease_expires_at"] == NOW + timedelta(minutes=2)
    repository.clock = lambda: NOW + timedelta(minutes=3)
    from quote_admin import QuoteNotificationService
    class Recovered:
        async def send(self, **kwargs):
            assert kwargs["idempotency_key"] == "quote-notification/q1"
            return "accepted-provider-id"
    await QuoteNotificationService(Recovered(), repository).retry(quote())
    assert collection.documents[0]["state"] == "sent"


@pytest.mark.asyncio
async def test_stale_worker_cannot_complete_reclaimed_lease():
    collection, repository, _, _ = leased_domain([pending()])
    assert hasattr(repository, "claim_notification"), "CAS lease claim is missing"
    claimed = await repository.claim_notification("delivery-q1")
    assert claimed is not None
    assert await repository.complete_notification("delivery-q1", "previous-worker", resend_email_id="old-id") is None
    assert collection.documents[0]["state"] == "pending"
    assert collection.documents[0]["lease_token"] == claimed.lease_token


def test_admin_expired_pending_retry_is_session_csrf_guarded_and_sanitized():
    from quote_admin import MongoQuoteRepository, create_quote_admin_router
    from test_quote_admin import Collection
    _, deliveries, service, sender = leased_domain([pending()])
    repository = MongoQuoteRepository(Collection([quote()]), deliveries)
    app = FastAPI()
    app.state.auth_service = RouteAuthService()
    app.include_router(create_quote_admin_router(repository, service))
    with TestClient(app) as client:
        assert client.post("/api/admin/quotes/q1/notification/retry").status_code == 401
        headers = authorize(client)
        assert client.post("/api/admin/quotes/q1/notification/retry").status_code == 403
        before = client.get("/api/admin/quotes/q1").json()["notification"]
        assert before["retryable"] is True
        response = client.post("/api/admin/quotes/q1/notification/retry", headers=headers)
        assert response.status_code == 200
        assert response.json()["notification"]["state"] == "sent"
        assert response.json()["notification"]["retryable"] is False
        assert "lease_token" not in response.text
        assert "accepted-provider-id" not in response.text
        assert len(sender.calls) == 1
