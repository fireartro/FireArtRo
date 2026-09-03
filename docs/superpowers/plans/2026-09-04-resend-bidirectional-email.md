# FireArtRo Resend Bidirectional Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable quote notifications, a signed Resend inbound webhook, an Admin inbox, and threaded replies while keeping all credentials and customer data server-side.

**Architecture:** FastAPI persists every quote or inbound message in MongoDB before attempting external delivery. A small HTTPX-based Resend client owns provider calls, while Mongo repositories own idempotency and status transitions. Existing Admin session and CSRF protection guard all inbox, reply, and retry operations. The public webhook verifies the exact raw body with Svix before any database or provider access.

**Tech Stack:** FastAPI, Pydantic v2, Motor/PyMongo, HTTPX, Svix, React 19, React Router, Jest/Testing Library, pytest.

## Global Constraints

- Work only in `C:\Users\Manu\.codex\worktrees\fireartro-production-setup` on `codex/resend-inbound-contact`.
- Never commit or print API keys, webhook secrets, MongoDB URLs, Admin hashes, customer email bodies, or other PII.
- Save the quote before attempting email. A Resend outage must never lose or reject an otherwise valid quote.
- Keep the public quote response exactly `{ "accepted": true }`.
- Do not send an automatic message to the visitor in this version.
- Do not render inbound HTML. Show only normalized plain text in Admin.
- Do not download or copy attachment binaries into MongoDB or public Blob storage; retain provider metadata only.
- Do not create Resend domains, keys, webhooks, DNS records, or Vercel variables while executing this code plan.
- Preserve all existing Admin session, CSRF, no-store, body-size, rate-limit, and optimistic-concurrency guarantees.

---

## Task 1: Lock the provider and persistence contracts with failing unit tests

**Files:**

- Create: `backend/tests/test_resend_email.py`
- Create: `backend/tests/test_email_inbox.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/requirements-dev.txt`

- [ ] Add tests for `ResendConfig.from_env()` covering disabled mode, complete enabled mode, and enabled-but-incomplete configuration. Assert errors contain safe codes such as `not_configured`, never secret values.
- [ ] Add an HTTPX `MockTransport` test for `POST https://api.resend.com/emails` that asserts the `Authorization` header is present, `Idempotency-Key` is exact, `from`/`to`/`reply_to` are correct, and the API key never appears in returned exceptions.
- [ ] Add tests for `GET https://api.resend.com/emails/receiving/{email_id}` that normalize sender, recipients, subject, text, HTML, message ID, references, and attachment metadata with explicit length caps.
- [ ] Add repository tests with async in-memory collections for unique `idempotency_key`, unique `resend_email_id`, unique `webhook_id`, state transitions, pagination, category filtering, and safe projections.
- [ ] Import the wished-for modules inside the test functions, then run the new tests and confirm pytest reports ordinary failed tests (not collection errors) because `resend_email` and `email_inbox` do not yet exist:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_resend_email.py backend/tests/test_email_inbox.py -q
```

- [ ] Add the Svix Python package to `backend/requirements.txt` with a bounded major version. `backend/requirements-dev.txt` already includes production requirements via `-r requirements.txt`, so do not duplicate the dependency there. Keep HTTPX at the existing version.
- [ ] Commit the contract tests and dependency declaration:

```powershell
git add backend/tests/test_resend_email.py backend/tests/test_email_inbox.py backend/requirements.txt backend/requirements-dev.txt
git commit -m "test: define Resend email contracts"
```

## Task 2: Implement the server-only Resend client

**Files:**

- Create: `backend/resend_email.py`
- Test: `backend/tests/test_resend_email.py`

**Interfaces:**

```python
class ResendConfig(BaseModel):
    enabled: bool
    api_key: str
    webhook_secret: str
    from_email: str
    notification_to: str
    inbound_domain: str
    inbound_address: str

class ResendClient:
    async def send(self, *, to, subject, text, html, idempotency_key,
                   reply_to=None, in_reply_to=None, references=None) -> str: ...
    async def get_received_email(self, email_id: str) -> ReceivedEmail: ...
```

- [ ] Implement strict environment parsing for `RESEND_ENABLED`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL`, `RESEND_NOTIFICATION_TO`, `RESEND_INBOUND_DOMAIN`, and `RESEND_INBOUND_ADDRESS`.
- [ ] Treat `RESEND_ENABLED=false` as an intentional disabled state. Treat `RESEND_ENABLED=true` with missing required values as fail-closed configuration for email operations, without affecting quote persistence.
- [ ] Implement provider calls through one injected `httpx.AsyncClient`, with bounded connect/read timeouts and no provider response body in logs or user-facing errors.
- [ ] Send `Idempotency-Key` on every outbound request and return only the provider message ID.
- [ ] Escape all interpolated customer fields before constructing HTML. Build a plain-text equivalent for every message.
- [ ] Normalize provider failures to safe internal codes: `not_configured`, `provider_rejected`, `provider_unavailable`, and `delivery_failed`.
- [ ] Run the focused tests until green:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_resend_email.py -q
```

- [ ] Commit:

```powershell
git add backend/resend_email.py backend/tests/test_resend_email.py
git commit -m "feat: add server-side Resend client"
```

## Task 3: Implement MongoDB delivery and inbox repositories

**Files:**

- Create: `backend/email_inbox.py`
- Test: `backend/tests/test_email_inbox.py`

**Data contracts:**

```python
DeliveryKind = Literal["quote_notification", "inbound_relay", "admin_reply"]
DeliveryState = Literal["pending", "sent", "failed"]
InboundCategory = Literal["contact", "other_recipient"]
```

- [ ] Implement Pydantic persistence and Admin response models for `email_deliveries` and `inbound_messages`. Use explicit allowlists so Admin list responses omit HTML and provider-only fields.
- [ ] Cap normalized fields before persistence: subject 300 characters, text 100,000 characters, archived HTML 200,000 characters, references 20 items, attachments 50 items, and filenames 240 characters.
- [ ] Implement `MongoEmailDeliveryRepository` methods to create-or-return by idempotency key, mark sent, mark failed with a safe code, retrieve the current quote notification, and list deliveries for one inbound message.
- [ ] Implement `MongoInboundMessageRepository` methods to reserve a verified webhook event, upsert by Resend email ID, list newest-first with search/category pagination, retrieve a safe detail, and update relay/reply state.
- [ ] Create indexes: unique delivery `id`, unique delivery `idempotency_key`, quote/time, inbound/time, state/update; unique inbound `id`, unique `resend_email_id`, unique `webhook_id`, received desc, category/received, and sender/received.
- [ ] Convert duplicate-key races into idempotent reads instead of 500 responses.
- [ ] Run repository tests until green:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_email_inbox.py -q
```

- [ ] Commit:

```powershell
git add backend/email_inbox.py backend/tests/test_email_inbox.py
git commit -m "feat: persist email inbox and delivery state"
```

## Task 4: Notify FireArtRo after a quote is persisted

**Files:**

- Modify: `backend/server.py`
- Modify: `backend/quote_admin.py`
- Modify: `backend/tests/test_quotes.py`
- Modify: `backend/tests/test_quote_admin.py`

- [ ] Add failing route tests proving the insert occurs before the send attempt, a provider failure still returns 200 and keeps the quote, repeated retry uses the same idempotency identity, and the public response never exposes delivery state or customer data.
- [ ] Construct `ResendClient`, delivery repository, and a `QuoteNotificationService` at server startup with dependency injection suitable for tests.
- [ ] After `db.quotes.insert_one(doc)` succeeds, create `quote-notification/{quote.id}` and synchronously attempt the bounded provider call. Catch only the email service's safe failure type; never roll back the quote.
- [ ] Use `FireArtRo <contact@fireart.ro>` as sender, `fireartro@gmail.com` as recipient, and the visitor's validated email as `Reply-To`.
- [ ] Extend private `QuoteDetail` with a safe `notification` object containing state, safe error code, and timestamps. Do not add provider IDs or email content to quote list responses.
- [ ] Add `POST /api/admin/quotes/{quote_id}/notification/retry`, protected by the existing Admin session and CSRF checks. Allow retry only when no delivery exists or the current state is `failed`; concurrent calls must converge on one idempotency key.
- [ ] Run focused tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_quotes.py backend/tests/test_quote_admin.py -q
```

- [ ] Commit:

```powershell
git add backend/server.py backend/quote_admin.py backend/tests/test_quotes.py backend/tests/test_quote_admin.py
git commit -m "feat: notify Admin about saved quotes"
```

## Task 5: Verify and process signed inbound webhooks

**Files:**

- Modify: `backend/email_inbox.py`
- Modify: `backend/server.py`
- Create: `backend/tests/test_resend_webhook.py`
- Modify: `backend/blog.py`
- Modify: `backend/tests/test_blog.py`
- Modify: `backend/tests/test_auth.py`

- [ ] Add failing API tests for missing Svix headers, invalid signature, a correctly signed `email.received`, unrelated event types, duplicate webhook ID, duplicate email ID, provider retrieval failure, Mongo failure, and relay failure.
- [ ] Add a dedicated 64 KiB request-body limit for `POST /api/webhooks/resend`; preserve 32 KiB for ordinary routes, 128 KiB for Blog writes, and 6 MiB for media.
- [ ] Extend database-unavailable middleware coverage to `/api/webhooks/resend` so it returns 503 before route work when MongoDB is unavailable.
- [ ] Verify the exact raw request bytes with `svix.Webhook.verify()` and the three required `svix-*` headers before reading event fields, calling MongoDB, or calling Resend.
- [ ] Return 400 for malformed/invalid signatures, 204 for valid events other than `email.received`, 204 for already completed duplicates, and 503 for retryable provider/database failures.
- [ ] Retrieve full content from Resend only after verification. Categorize as `contact` only when normalized recipients include `contact@fireart.ro`; store all other root-domain recipients as `other_recipient`.
- [ ] Persist the inbound message before sending the Gmail alert. Use `inbound-relay/{resend_email_id}` as the delivery key.
- [ ] Never log request bodies, sender/recipient addresses, subject, text, HTML, or provider responses.
- [ ] Run focused security and webhook tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_resend_webhook.py backend/tests/test_blog.py backend/tests/test_auth.py -q
```

- [ ] Commit:

```powershell
git add backend/email_inbox.py backend/server.py backend/blog.py backend/tests/test_resend_webhook.py backend/tests/test_blog.py backend/tests/test_auth.py
git commit -m "feat: receive signed Resend webhooks"
```

## Task 6: Add authenticated inbox, reply, and retry endpoints

**Files:**

- Modify: `backend/email_inbox.py`
- Modify: `backend/server.py`
- Create: `backend/tests/test_email_inbox_routes.py`

**Routes:**

```text
GET  /api/admin/inbox?q=&category=&page=&page_size=
GET  /api/admin/inbox/{message_id}
POST /api/admin/inbox/{message_id}/relay/retry
POST /api/admin/inbox/{message_id}/reply
```

- [ ] Add failing tests proving every route requires an Admin session, mutation routes require CSRF, responses are `Cache-Control: no-store`, list data excludes message bodies, and arbitrary recipients cannot be supplied.
- [ ] Validate reply text as trimmed plain text from 1 to 12,000 characters. Resolve the destination exclusively from the stored verified sender.
- [ ] Build reply subject as `Re: <original>` without repeated `Re:` prefixes. Set `In-Reply-To` from the stored message ID and cap `References` to the latest 20 valid values.
- [ ] Use `admin-reply/{inbound_message_id}/{reply_uuid}` for outbound idempotency and persist the local reply/delivery before calling Resend.
- [ ] Implement explicit relay retry only for failed relay state, preserving `inbound-relay/{resend_email_id}`.
- [ ] Ensure session expiry returns 401 and removes message content from subsequent frontend state.
- [ ] Run route tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_email_inbox_routes.py -q
```

- [ ] Commit:

```powershell
git add backend/email_inbox.py backend/server.py backend/tests/test_email_inbox_routes.py
git commit -m "feat: expose protected Admin email inbox"
```

## Task 7: Add the Admin inbox UI

**Files:**

- Create: `frontend/src/lib/inboxApi.js`
- Create: `frontend/src/admin/AdminInbox.jsx`
- Create: `frontend/src/admin/AdminInbox.test.jsx`
- Modify: `frontend/src/admin/AdminLayout.jsx`
- Modify: `frontend/src/admin.css`

- [ ] Add failing React tests for authenticated list/load, search, category filter, safe text rendering of HTML-like content, detail switching race protection, reply validation, failed reply draft retention, session expiry, relay retry, and mobile layout.
- [ ] Implement API helpers that use the existing `AdminSessionContext.request()` method and never persist message content in localStorage, URL query values, console output, or analytics.
- [ ] Add `Mesaje` to `Operațiuni` and route `sectiune=inbox` to `AdminInbox` without changing the single shared Admin account model.
- [ ] Build a two-pane desktop layout and one-column mobile layout using existing Admin panel, field, button, notice, focus, and color tokens. Avoid inline style duplication used by the older quotes module.
- [ ] Show sender, subject, received time, category, relay state, normalized text, attachment names/types/sizes, and thread replies. Never inject archived HTML with `dangerouslySetInnerHTML`.
- [ ] Preserve the reply draft after network failure; clear it only after a confirmed successful response. Require explicit reload after a conflict or expired session.
- [ ] Run focused tests:

```powershell
corepack yarn --cwd frontend test AdminInbox.test.jsx --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add frontend/src/lib/inboxApi.js frontend/src/admin/AdminInbox.jsx frontend/src/admin/AdminInbox.test.jsx frontend/src/admin/AdminLayout.jsx frontend/src/admin.css
git commit -m "feat: add Admin email inbox"
```

## Task 8: Surface quote notification state and Resend integration health

**Files:**

- Modify: `frontend/src/lib/quotesApi.js`
- Modify: `frontend/src/admin/AdminQuotes.jsx`
- Modify: `frontend/src/admin/AdminQuotes.test.jsx`
- Modify: `backend/integrations.py`
- Modify: `backend/tests/test_integrations.py`
- Modify: `frontend/src/admin/AdminIntegrations.jsx`
- Modify: `frontend/src/admin/AdminIntegrations.test.jsx`

- [ ] Add failing tests for a quote with `sent`, `pending`, and `failed` notification states and for explicit retry behavior.
- [ ] Add `retryQuoteNotification()` to the frontend API module and render a compact status in quote detail. Offer retry only when the backend says it is allowed.
- [ ] Extend the sanitized integration response with `resend`. Mark it configured only when enabled and all required server-only settings are present; never return addresses, keys, secrets, provider IDs, or raw error text.
- [ ] Add the Resend card to the existing integration grid and preserve the current refresh throttling.
- [ ] Run focused tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_integrations.py backend/tests/test_quote_admin.py -q
corepack yarn --cwd frontend test AdminQuotes.test.jsx AdminIntegrations.test.jsx --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add frontend/src/lib/quotesApi.js frontend/src/admin/AdminQuotes.jsx frontend/src/admin/AdminQuotes.test.jsx backend/integrations.py backend/tests/test_integrations.py frontend/src/admin/AdminIntegrations.jsx frontend/src/admin/AdminIntegrations.test.jsx
git commit -m "feat: expose safe email delivery status"
```

## Task 9: Document configuration and recovery operations

**Files:**

- Modify: `backend/.env.example`
- Modify: `frontend/.env.example`
- Create: `docs/runbooks/fireartro-resend-setup.md`

- [ ] Document every Resend variable with Preview/Production scope, secrecy, expected format, and disabled behavior. Keep `RESEND_ENABLED=false` in examples.
- [ ] Document the exact safe order: verify sending domain, verify sender, deploy webhook code, create `email.received` webhook, copy secret directly into Vercel, test signed delivery, inventory current MX, then change inbound MX only after a separate confirmation.
- [ ] Document webhook replay, failed quote alert retry, failed relay retry, provider outage behavior, and how to disable sending without losing quotes.
- [ ] Document that attachment binaries remain in Resend and are not copied into the public application.
- [ ] Confirm no secret-looking value entered source control:

```powershell
rg -n --hidden --glob '!node_modules/**' --glob '!frontend/node_modules/**' --glob '!.git/**' 're_[A-Za-z0-9_]{20,}|whsec_[A-Za-z0-9_]{20,}|MONGODB_URI=.*mongodb\+srv' .
```

- [ ] Commit:

```powershell
git add backend/.env.example frontend/.env.example docs/runbooks/fireartro-resend-setup.md
git commit -m "docs: add Resend production runbook"
```

## Task 10: Run complete email regression verification

**Files:**

- Verify only; fix failures in the files from Tasks 1–9.

- [ ] Run the complete backend suite:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests -q
```

- [ ] Run all root API and frontend tests:

```powershell
npm run test:api
corepack yarn --cwd frontend test --watchAll=false --runInBand
```

- [ ] Build the production frontend:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; corepack yarn --cwd frontend build
```

- [ ] Inspect the build and tracked diff for secret or PII leakage. Confirm the bundle contains no `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, email bodies, or test customer addresses.
- [ ] Confirm `git status --short` contains only intentional source/test/doc changes and no `.env`, test cache, build output, or dependency directory.
- [ ] Commit any verification-only corrections, then record the tested commands in the eventual pull request description. Do not push or merge from this plan without the user's explicit instruction.
