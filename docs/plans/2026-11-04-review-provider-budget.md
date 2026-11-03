# Review provider budget implementation plan

**Goal:** Close the confirmed anonymous Google Places quota-consumption path without changing the public design, review payload or hero media.

**Architecture:** Enforce provider-attempt budgets inside `ReviewsService`, shared by the public route and integration-health calls. Use the existing Mongo revision-CAS convention in a dedicated bounded document for each provider. Coalesce only in-flight tasks in one instance; a shared expiring lease prevents concurrent provider calls across instances. Store counters, HMAC client identities and lease/backoff metadata, never Google review content.

**Tech stack:** Existing FastAPI, Motor/PyMongo, asyncio and pytest; no new dependency.

## Constraints and decisions

- Preserve missing/partial provider configuration as HTTP 200 with an empty provider list.
- Preserve Facebook's existing cache and Google's fresh sequential fetches within the budget.
- Keep a functioning provider visible when the other fails or is throttled.
- Allow at most 10 provider attempts per client/minute, 60 per provider/minute and 1,000 per provider/day, using rolling windows independent of TTL cleanup.
- Allow one in-flight provider call across instances. Its 15-second lease exceeds the absolute 5-second provider deadline; a stale owner cannot release a replacement.
- Share an in-flight result only until its task completes. A disconnected waiter must not cancel that task for other waiters.
- Back off 30 seconds after provider failures. `force=True` and integration health cannot bypass budgets, leases or backoff.
- Return HTTP 429 with positive `Retry-After` when no provider can supply data because a budget/lease/backoff is exhausted. Return sanitized HTTP 503 if shared enforcement is unavailable. Preserve `Cache-Control: no-store, private`.
- Reuse `auth.request_ip`; do not trust arbitrary forwarded headers. Persist only a domain-separated HMAC, using the existing server-side session secret.
- One fixed document per provider bounds storage even if an attacker rotates IPs. Entries are pruned by the one-day window and capped by the daily budget.
- Provider account restrictions and hard quotas are a separate live configuration check. Do not enable billing or create credentials implicitly.

## Task 1: Reproduce and close the shared provider boundary

Files: create `backend/review_budget.py`; modify `backend/reviews.py`, `backend/server.py`, `backend/tests/test_reviews.py`; create `backend/tests/test_review_budget.py`.

Interfaces: `MongoReviewBudget(collection, secret, clock=..., client_limit=10, minute_limit=60, day_limit=1000)` exposes `create_indexes()`, `reserve(provider, client_ip) -> lease_token`, and `complete(provider, lease_token, failed=False)`. `ReviewsService(..., budget=...)` accepts `get_snapshot(client_ip='internal', force=False)`; production passes the shared Mongo guard and the public route supplies `request_ip(request)`.

- [x] Add the anonymous 24-request regression and observe 24 accepted calls before the fix.
- [x] Implement the bounded Mongo CAS/lease policy and generic 429/503 errors.
- [x] Inject the policy into the actual server composition and index initialization.
- [x] Guard each provider call before dispatch, coalesce local in-flight tasks, enforce an absolute deadline, and preserve partial-provider/error semantics.
- [x] Test sequential/client/global/daily exhaustion across two guards, insert/CAS races, TTL-independent rollover, expired and stale leases, fail-closed storage, backoff, cancellation, direct/forced/admin service paths, and no Google-content caching.
- [x] Run the focused tests with credentials removed and sockets blocked: `python backend/tests/offline_regression_runner.py backend/tests/test_review_budget.py backend/tests/test_reviews.py backend/tests/test_integrations.py backend/tests/test_auth.py` (196 passed, 7 skipped before four additional regression cases; the final suite is recorded in the fix report).

## Task 2: Review and verify the candidate

- [x] Obtain one fresh read-only bypass/regression review of the finding and candidate diff (no concrete surviving bypass/regression).
- [x] Confirm and fix any concrete review issue, then rerun affected checks (none reported by the reviewer).
- [x] Run the complete offline backend suite and the existing API/deployment checks (549 passed, 10 optional skips; 81 API/config tests passed). Global Python's older FastAPI/Starlette failed two multipart checks; the isolated environment installed from repository requirements passes both. `pip check` reports no conflicts.
- [x] Update the review-activation runbook with exact application limits, failure behavior, and external quota instructions.
- [ ] Check current Google Cloud quotas/key restrictions without enabling billing, creating a key or making billable provider calls. Live console confirms no linked billing account; opening Places quotas redirects to mandatory phone/payment account verification, so the external settings are unverified and unchanged.
- [ ] Keep the sealed original security report unchanged; save a separate fix report with commands/results and remaining live configuration limits.
- [ ] Commit the focused change and prepare the existing GitHub/Vercel review path using the established repository, without changing business content or design.
