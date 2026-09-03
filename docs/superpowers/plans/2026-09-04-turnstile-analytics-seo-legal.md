# FireArtRo Turnstile, Analytics, SEO, and Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the quote form, add consent-gated GA4, make `https://fireart.ro` the single canonical origin, generate a published-only Blog sitemap, and align the legal copy and Admin health view with the services actually enabled.

**Architecture:** Turnstile is optional in local/Preview environments but fail-closed in Production when enabled, with verification performed only by FastAPI. GA4 uses Basic Consent Mode and is not downloaded until analytics consent exists. Canonical URLs use a code-owned constant rather than editable CMS data or request host headers. Dynamic sitemap XML is generated server-side from fixed routes plus published Blog slugs.

**Tech Stack:** FastAPI, HTTPX, Motor/PyMongo, React 19, React Router, Cloudflare Turnstile, Google Analytics 4, Jest, pytest, Vercel configuration.

## Global Constraints

- Keep `TURNSTILE_SECRET_KEY` and all provider secrets server-side. Only the Turnstile site key and GA measurement ID may use `REACT_APP_*`.
- Do not load GA4, create `dataLayer`, send page views, or contact Google Analytics before explicit analytics consent.
- Do not send names, email addresses, phone numbers, quote IDs, form content, search/query parameters, Admin paths, or other PII to Analytics.
- Do not trust `Host`, `X-Forwarded-Host`, editable CMS `siteUrl`, or incoming URLs when constructing canonical URLs or sitemap entries.
- Keep Google/Facebook reviews unconfigured and hidden; point 8 remains excluded.
- Do not change external DNS, Turnstile, GA4, Vercel, or Atlas configuration while executing this code plan.
- Update legal claims only to describe code or providers that are genuinely configured; use conditional wording for providers not yet activated.

---

## Task 1: Define Turnstile server verification with failing tests

**Files:**

- Create: `backend/tests/test_turnstile.py`
- Create: `backend/turnstile.py`

**Interface:**

```python
class TurnstileVerifier:
    @classmethod
    def from_env(cls, env, *, transport=None) -> "TurnstileVerifier": ...
    async def verify(self, token: str, remote_ip: str) -> None: ...
```

- [ ] Add tests for disabled mode, valid token, invalid token, missing token, enabled-without-secret configuration, provider timeout, malformed provider response, and one-time token rejection.
- [ ] Assert all failures map to stable public Romanian messages and safe internal codes without exposing the secret, submitted token, IP address, or provider body.
- [ ] Implement `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, and normalized `remoteip`, using an injected HTTPX transport and bounded timeout.
- [ ] Fail closed whenever `TURNSTILE_ENABLED=true` and the secret is absent, the provider is unavailable, or verification does not return `success: true`.
- [ ] Treat disabled mode as a no-op only when the environment flag is explicitly false.
- [ ] Run tests until green:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_turnstile.py -q
```

- [ ] Commit:

```powershell
git add backend/turnstile.py backend/tests/test_turnstile.py
git commit -m "feat: verify Turnstile server-side"
```

## Task 2: Enforce Turnstile on public quote submissions

**Files:**

- Modify: `backend/server.py`
- Modify: `backend/tests/test_quotes.py`
- Modify: `backend/.env.example`

- [ ] Add `turnstile_token: str = Field(default="", max_length=4096)` to the public input model and exclude it from the persisted quote document.
- [ ] Add failing route tests proving verification runs before rate-limit/persistence for a real submission, honeypot traffic receives the existing generic acknowledgement without provider work, invalid tokens create no quote, and valid tokens are never stored or returned.
- [ ] Instantiate the verifier once at startup and inject a fake in tests. Preserve the existing consent validation, request-IP normalization, rate limit, honeypot behavior, and `{ "accepted": true }` response.
- [ ] Verify the token immediately after the honeypot short-circuit and before persistence. Return 422 for invalid/expired tokens and 503 for a configured provider outage.
- [ ] Document `TURNSTILE_ENABLED=false` and empty `TURNSTILE_SECRET_KEY` in `backend/.env.example`, including the requirement that Production uses `true` plus a real secret.
- [ ] Run focused tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_turnstile.py backend/tests/test_quotes.py -q
```

- [ ] Commit:

```powershell
git add backend/server.py backend/tests/test_quotes.py backend/.env.example
git commit -m "feat: protect quote submissions with Turnstile"
```

## Task 3: Add the accessible Turnstile widget to the quote form

**Files:**

- Create: `frontend/src/components/site/TurnstileWidget.jsx`
- Create: `frontend/src/components/site/TurnstileWidget.test.jsx`
- Modify: `frontend/src/components/site/QuoteForm.jsx`
- Create: `frontend/src/components/site/QuoteForm.test.jsx`
- Modify: `frontend/src/styles/night-contact.css`
- Modify: `frontend/.env.example`

- [ ] Add failing component tests for absent site key, script load, successful callback, expiration, provider error, reset after backend rejection, reset after success, and keyboard/focus behavior.
- [ ] Load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once, with no inline secret or client-side verification assumption.
- [ ] Render explicitly into a stable container, request a new token after expiry/error, and remove stale callbacks on unmount. Expose only `token`, `onToken`, and `onUnavailable` to the form.
- [ ] Keep the widget hidden only when `REACT_APP_TURNSTILE_SITE_KEY` is absent. When present, require a current token before submission and place a clear Romanian error adjacent to the widget.
- [ ] Add `turnstile_token` only to the outgoing API payload. Never persist it in React storage, URL state, logs, toasts, or Admin.
- [ ] On failed submission reset the widget/token so a single-use or expired token cannot be retried. On success clear it with the rest of the form.
- [ ] Style the widget container to fit the approved dark contact form on desktop and mobile without changing the surrounding layout.
- [ ] Document `REACT_APP_TURNSTILE_SITE_KEY` as public and environment-specific.
- [ ] Run focused tests:

```powershell
corepack yarn --cwd frontend test TurnstileWidget.test.jsx QuoteForm.test.jsx --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add frontend/src/components/site/TurnstileWidget.jsx frontend/src/components/site/TurnstileWidget.test.jsx frontend/src/components/site/QuoteForm.jsx frontend/src/components/site/QuoteForm.test.jsx frontend/src/styles/night-contact.css frontend/.env.example
git commit -m "feat: add Turnstile to the quote form"
```

## Task 4: Add GA4 Basic Consent Mode without pre-consent requests

**Files:**

- Create: `frontend/src/components/site/AnalyticsLoader.jsx`
- Create: `frontend/src/components/site/AnalyticsLoader.test.jsx`
- Modify: `frontend/src/components/site/CookieConsent.jsx`
- Modify: `frontend/src/App.js`
- Modify: `frontend/.env.example`

- [ ] Export a single `COOKIE_CONSENT_UPDATED_EVENT` constant and a safe `readCookieConsent()` helper from `CookieConsent.jsx`; keep the existing localStorage format and retention behavior.
- [ ] Add failing tests proving an absent or malformed `REACT_APP_GA_MEASUREMENT_ID` does nothing, denied/unknown consent creates no Google script or network command, accepted consent creates one script, route changes send sanitized page paths, and consent withdrawal prevents future page views.
- [ ] Implement `AnalyticsLoader` inside `BrowserRouter`. Validate IDs with `^G-[A-Z0-9]+$` before use.
- [ ] In accepted mode only, initialize `window.dataLayer`, issue default denied consent before loading the tag, append one async `gtag/js?id=...` script, update `analytics_storage` to granted, and call `config` with `send_page_view: false`.
- [ ] Send manual `page_view` events only for public route pathnames. Strip query strings and hashes; ignore `/admin`; set advertising-related storage to denied and disable Google Signals/ad personalization.
- [ ] On withdrawal, issue a denied consent update and stop application-triggered page-view events. Do not attempt to clear unrelated cookies.
- [ ] Keep Analytics out of `frontend/public/index.html`; no tag may run before React reads consent.
- [ ] Document the public build-time measurement ID in `frontend/.env.example`.
- [ ] Run focused tests:

```powershell
corepack yarn --cwd frontend test AnalyticsLoader.test.jsx --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add frontend/src/components/site/AnalyticsLoader.jsx frontend/src/components/site/AnalyticsLoader.test.jsx frontend/src/components/site/CookieConsent.jsx frontend/src/App.js frontend/.env.example
git commit -m "feat: load GA4 only after analytics consent"
```

## Task 5: Make `fireart.ro` the code-owned canonical origin

**Files:**

- Create: `frontend/src/lib/siteOrigin.js`
- Create: `frontend/src/lib/siteOrigin.test.js`
- Modify: `frontend/src/hooks/usePageMeta.js`
- Create: `frontend/src/hooks/usePageMeta.test.js`
- Modify: `frontend/src/data/businessContent.js`
- Modify: `frontend/src/data/cmsDefaults.js`
- Modify: `frontend/src/content/__fixtures__/siteContent.json`
- Modify: `backend/tests/test_cms_models.py`

**Interface:**

```javascript
export const CANONICAL_SITE_ORIGIN = "https://fireart.ro";
export function canonicalUrl(pathname = "/") { ... }
```

- [ ] Add failing tests for root/path joining, duplicate slashes, query/hash removal, external-path rejection, and immunity to editable CMS `siteUrl` values.
- [ ] Use the canonical helper for canonical, Open Graph, Twitter image, and page-schema URLs. Keep the current page title/description behavior.
- [ ] Change default and fixture `siteUrl` values to `https://fireart.ro`, while treating this CMS field as informational rather than authoritative for SEO.
- [ ] Update affected CMS model tests to expect the canonical origin.
- [ ] Search for every remaining old origin and classify it before replacement:

```powershell
rg -n --glob '!node_modules/**' --glob '!frontend/node_modules/**' 'https://www\.fireartro\.ro|www\.fireartro\.ro' .
```

- [ ] Run focused tests:

```powershell
corepack yarn --cwd frontend test siteOrigin.test.js usePageMeta.test.js --watchAll=false --runInBand
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_cms_models.py -q
```

- [ ] Commit:

```powershell
git add frontend/src/lib/siteOrigin.js frontend/src/lib/siteOrigin.test.js frontend/src/hooks/usePageMeta.js frontend/src/hooks/usePageMeta.test.js frontend/src/data/businessContent.js frontend/src/data/cmsDefaults.js frontend/src/content/__fixtures__/siteContent.json backend/tests/test_cms_models.py
git commit -m "fix: use fireart.ro as canonical origin"
```

## Task 6: Update static metadata, CORS, CSP, and domain redirects

**Files:**

- Modify: `frontend/public/index.html`
- Modify: `frontend/public/robots.txt`
- Delete: `frontend/public/sitemap.xml`
- Modify: `backend/.env.example`
- Modify: `backend/server.py`
- Modify: `backend/tests/test_auth.py`
- Modify: `vercel.json`
- Create: `backend/tests/test_vercel_config.py`

- [ ] Add config tests that parse `vercel.json` and assert five permanent host redirects preserve `/:path*`, API rewrites still precede SPA fallback behavior, and CSP allows only the exact Turnstile/GA hosts required by Tasks 3–4.
- [ ] Replace every static canonical, Open Graph, Twitter, JSON-LD, image, and WebSite origin in `index.html` with `https://fireart.ro`.
- [ ] Change backend and example CORS defaults to `https://fireart.ro`; document local origins separately and do not add wildcard origins.
- [ ] Add permanent redirects for `www.fireart.ro`, `fireartro.ro`, `www.fireartro.ro`, `fireartro.com`, and `www.fireartro.com` to `https://fireart.ro/:path*`, preserving query strings through Vercel's redirect behavior.
- [ ] Extend CSP narrowly: Turnstile in `script-src` and `frame-src`; Google tag host in `script-src`; Google Analytics collection hosts in `connect-src`; retain all existing object/frame/base protections.
- [ ] Remove the stale static sitemap and point `robots.txt` to `https://fireart.ro/api/sitemap.xml`.
- [ ] Run tests and JSON validation:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_auth.py backend/tests/test_vercel_config.py -q
Get-Content vercel.json -Raw | ConvertFrom-Json | Out-Null
```

- [ ] Commit:

```powershell
git add frontend/public/index.html frontend/public/robots.txt frontend/public/sitemap.xml backend/.env.example backend/server.py backend/tests/test_auth.py backend/tests/test_vercel_config.py vercel.json
git commit -m "fix: canonicalize production domains"
```

## Task 7: Generate a published-only dynamic Blog sitemap

**Files:**

- Create: `backend/sitemap.py`
- Create: `backend/tests/test_sitemap.py`
- Modify: `backend/server.py`
- Modify: `backend/blog.py`

- [ ] Add failing tests for fixed public pages, XML escaping, canonical root, newest published Blog slugs, exclusion of drafts/deleted posts/Admin routes, deterministic ordering, no host-header influence, and `application/xml` with a cache policy.
- [ ] Add a repository/service method that returns only published Blog `slug` and `updated_at` fields, bounded to the site's supported article count and sorted deterministically.
- [ ] Implement `GET /api/sitemap.xml` with a constant `https://fireart.ro` origin and the fixed routes `/`, `/pachete`, `/galerie`, `/intrebari-frecvente`, `/contact`, `/blog`, and the three legal routes.
- [ ] Return 503 when MongoDB is unavailable rather than silently omitting Blog URLs. Never include unpublished content or user-provided absolute URLs.
- [ ] Add `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on successful XML and `no-store` on errors.
- [ ] Run focused tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_sitemap.py backend/tests/test_blog.py -q
```

- [ ] Commit:

```powershell
git add backend/sitemap.py backend/tests/test_sitemap.py backend/server.py backend/blog.py
git commit -m "feat: generate the public Blog sitemap"
```

## Task 8: Align legal copy with the implemented data flows

**Files:**

- Modify: `frontend/src/data/legalContent.js`
- Modify: `frontend/src/data/cmsDefaults.js`
- Create: `frontend/src/data/legalContent.test.js`

- [ ] Add snapshot/content tests that require explicit coverage of quote data, Admin publishing, MongoDB persistence, Resend sending/receiving, Turnstile anti-abuse, GA4 only after consent, localStorage consent, retention principles, processors, contact rights, and withdrawal/settings instructions.
- [ ] Remove the outdated claim that rate limiting stores the IP only in server memory; the current implementation uses a short-lived MongoDB rate-limit collection.
- [ ] State that incoming email and Admin replies may be processed through Resend only after the email feature is activated, and that quote data/inbound messages are stored in the application's database.
- [ ] State that Turnstile processes technical anti-abuse data when enabled and that the form cannot be submitted without successful server verification.
- [ ] State that GA4 is optional, disabled before analytics consent, and receives no form fields or intentional user identifiers from FireArtRo.
- [ ] Update `updated` labels to the actual implementation date. Keep the existing Romanian legal entity data and official ANPC/ANSPDCP links unchanged.
- [ ] Add a visible sentence that final legal review remains the operator's responsibility; do not present the source copy as legal advice.
- [ ] Run focused tests:

```powershell
corepack yarn --cwd frontend test legalContent.test.js --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add frontend/src/data/legalContent.js frontend/src/data/cmsDefaults.js frontend/src/data/legalContent.test.js
git commit -m "docs: align privacy and cookie disclosures"
```

## Task 9: Extend the safe Admin integration status

**Files:**

- Modify: `backend/integrations.py`
- Modify: `backend/tests/test_integrations.py`
- Modify: `frontend/src/admin/AdminIntegrations.jsx`
- Modify: `frontend/src/admin/AdminIntegrations.test.jsx`

- [ ] Extend the response with `turnstile` and `analytics`, while keeping `resend` from the email plan and the existing database/blob/review fields.
- [ ] Mark Turnstile configured only when enabled and its server secret is present. Mark Analytics configured from a matching server-only `GA_MEASUREMENT_ID` status value; return no measurement ID.
- [ ] Preserve the safe `configured`, `healthy`, `checked_at`, and generic `message` contract. Never serialize environment values.
- [ ] Add corresponding Admin cards. Leave Google and Facebook review cards in the unconfigured state because review integration is excluded.
- [ ] Add tests that seed obvious secret strings and assert none occur anywhere in the response or rendered Admin text.
- [ ] Run focused tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests/test_integrations.py -q
corepack yarn --cwd frontend test AdminIntegrations.test.jsx --watchAll=false --runInBand
```

- [ ] Commit:

```powershell
git add backend/integrations.py backend/tests/test_integrations.py frontend/src/admin/AdminIntegrations.jsx frontend/src/admin/AdminIntegrations.test.jsx
git commit -m "feat: report safe production integration state"
```

## Task 10: Add deployment configuration documentation

**Files:**

- Create: `docs/runbooks/fireartro-environment-variables.md`
- Create: `docs/runbooks/fireartro-turnstile-ga4.md`

- [ ] Document Development, Preview, and Production values for `PUBLIC_SITE_URL`, `CORS_ORIGINS`, `TURNSTILE_ENABLED`, `TURNSTILE_SECRET_KEY`, `REACT_APP_TURNSTILE_SITE_KEY`, `GA_MEASUREMENT_ID`, and `REACT_APP_GA_MEASUREMENT_ID`.
- [ ] Explicitly mark which values are secrets and which are embedded in the frontend build. Require Preview and Production Turnstile widgets/keys to be distinct.
- [ ] Document that changing `REACT_APP_*` requires a new frontend deployment, while server-only environment changes affect functions after redeployment.
- [ ] Document GA consent acceptance, refusal, customization, withdrawal, SPA navigation, and DevTools checks showing no pre-consent Google request.
- [ ] Document Turnstile valid, expired, duplicate, provider-down, and disabled-environment checks.
- [ ] Commit:

```powershell
git add docs/runbooks/fireartro-environment-variables.md docs/runbooks/fireartro-turnstile-ga4.md
git commit -m "docs: add Turnstile and Analytics runbooks"
```

## Task 11: Run full regression and leak checks

**Files:**

- Verify only; repair regressions in files modified by Tasks 1–10.

- [ ] Run all backend tests:

```powershell
$env:PYTHONPATH='backend'; python -m pytest backend/tests -q
```

- [ ] Run all frontend and root API tests:

```powershell
npm run test:api
corepack yarn --cwd frontend test --watchAll=false --runInBand
```

- [ ] Build the production frontend:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; corepack yarn --cwd frontend build
```

- [ ] Search source and built assets. Confirm there is no Turnstile secret, Admin secret, Resend secret, Mongo URL, quote content, or old canonical origin. The GA ID and Turnstile site key are allowed only as public identifiers.
- [ ] Confirm `robots.txt` points to the live API sitemap and `vercel.json` parses cleanly with the existing API and SPA routing intact.
- [ ] Confirm `git status --short` contains no `.env`, build output, cache, or dependency directories.
- [ ] Commit any focused corrections. Do not push, merge, deploy, configure DNS, or create provider resources without explicit instruction and the required immediate confirmations.
