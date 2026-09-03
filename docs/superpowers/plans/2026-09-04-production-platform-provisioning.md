# FireArtRo Production Platform Provisioning Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the new FireArtRo repository to production services, make Admin publication persistent without Git pushes, activate `fireart.ro`, and configure email, anti-spam, Analytics, access, and deployment settings for the agreed launch scope.

**Architecture:** GitHub `main` is the protected production source. Vercel builds the React frontend and runs the existing FastAPI functions on the same origin. MongoDB Atlas stores Admin drafts/publications, quotes, Blog, sessions, and email inbox data; Vercel Blob stores public media; Resend handles `contact@fireart.ro`; Turnstile protects the public form; GA4 loads only after consent.

**Tech Stack:** GitHub, Vercel, MongoDB Atlas, Vercel Blob, Resend, ROMARG DNS, Cloudflare Turnstile, Google Analytics 4, FastAPI, React.

## Global Constraints

- Official repository: `https://github.com/fireartro/FireArtRo.git`. Never modify or reconnect the old Git repository/account.
- Canonical production domain: `https://fireart.ro`.
- Redirect `www.fireart.ro`, `fireartro.ro`, `www.fireartro.ro`, `fireartro.com`, and `www.fireartro.com` to the canonical origin while preserving path and query.
- Service operations use `fireartro@gmail.com`; invite `ebejerea@gmail.com` as the second platform administrator wherever membership is supported.
- The application itself keeps one shared Admin profile in this phase; do not add multi-user application authentication.
- All credentials are entered directly into provider dashboards or Vercel Environment Variables. Never paste them into chat, terminal output, source files, screenshots, issue text, or documentation.
- Before every persistent external action—creating a project/store/key/webhook/property, inviting a member, changing a permission, adding an environment variable, changing DNS, deploying, or merging—obtain a fresh immediate confirmation from the user.
- FireArtRo is commercial. Do not deploy it under Vercel Hobby contrary to Vercel's commercial-use rules. Stop at the Vercel plan gate until Pro or another explicitly approved commercial host is selected.
- MongoDB Atlas M0 has no automated backups. This plan may document manual export/restore, but operational backup/monitoring remains excluded as point 13.
- Keep Google/Facebook reviews disabled. Exclude complete QA (12), monitoring/backups operations (13), launch-day execution (14), and post-launch operations (15).

---

## Task 1: Record the ownership, scope, and readiness gates

**Files:**

- Create: `docs/runbooks/fireartro-production-ownership.md`
- Create: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Record Ionuț Barbul as business owner, `fireartro@gmail.com` as operational service account, and `ebejerea@gmail.com` as the second platform administrator.
- [ ] Record the single in-app Admin account separately from provider memberships, including who may rotate its password and session secret.
- [ ] List the included scope as points 0–7 and 9–11 and the excluded points 8 and 12–15.
- [ ] Add explicit gates for Vercel commercial plan, DNS/MX change, production deployment, Admin bootstrap, and domain cutover.
- [ ] Add a provider inventory table with fields for owner, second admin, 2FA status, recovery method verified, billing owner, resource ID, and last verification time. Store no codes or secrets.
- [ ] Commit:

```powershell
git add docs/runbooks/fireartro-production-ownership.md docs/runbooks/fireartro-production-checklist.md
git commit -m "docs: define production ownership and gates"
```

## Task 2: Prepare GitHub governance for the new repository

**Files:**

- Create: `.github/CODEOWNERS`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/runbooks/fireartro-production-ownership.md`

- [ ] Verify locally that `origin` is exactly the new `fireartro/FireArtRo` repository and that no old remote remains.
- [ ] Add CODEOWNERS entries for application code, Vercel/API configuration, and runbooks using the confirmed GitHub usernames—not email addresses guessed from account names.
- [ ] Ensure CI runs backend tests, root API tests, frontend tests, and production build on pull requests and `main` pushes with read-only default permissions.
- [ ] Push only the feature branch after explicit instruction. Open a pull request; do not push implementation commits directly to `main`.
- [ ] Immediately before the external change, confirm inviting `ebejerea@gmail.com` to the correct GitHub organization/repository and enabling the available 2FA/security requirements.
- [ ] Configure `main` protection/ruleset to require the CI checks, disallow force pushes/deletion, and require pull requests. If the selected plan cannot require a second approval, document the platform limit rather than claiming it is enforced.
- [ ] Verify a test branch cannot bypass required checks, then record the ruleset URL/ID without copying tokens.
- [ ] Commit local governance files:

```powershell
git add .github/CODEOWNERS .github/workflows/ci.yml docs/runbooks/fireartro-production-ownership.md
git commit -m "ci: prepare protected production workflow"
```

## Task 3: Resolve the commercial hosting gate and create the Vercel project

**Files:**

- Modify: `docs/runbooks/fireartro-production-checklist.md`
- Modify: `docs/runbooks/fireartro-environment-variables.md`

- [ ] Present the Vercel Pro requirement and current price/terms from Vercel's official dashboard at action time. Do not purchase or switch plans without immediate confirmation.
- [ ] If Pro is approved, create one Vercel project under the FireArtRo-owned account/team and import only `fireartro/FireArtRo`.
- [ ] Set Production Branch to `main`, Framework Preset to Other/CRA as detected, Root Directory to repository root, and retain the checked-in install/build/output settings from `vercel.json`.
- [ ] Invite `ebejerea@gmail.com` as the least-privileged role that can manage deployments/configuration, only after immediate confirmation.
- [ ] Disable automatic Production deployment from branches other than `main`; retain Preview deployments for pull requests.
- [ ] Do not create a first production deployment until Atlas, Blob, Admin credentials, CORS, and provider disabled defaults are entered.
- [ ] Record Vercel project/team IDs and dashboard links in the runbook; store no tokens.

## Task 4: Provision MongoDB Atlas for persistent Admin publication

**Files:**

- Create: `docs/runbooks/fireartro-atlas-setup.md`
- Modify: `docs/runbooks/fireartro-environment-variables.md`

- [ ] Under the FireArtRo-owned Atlas organization, create a project and one M0 cluster in the closest available European region, after immediate confirmation.
- [ ] Use separate logical databases `fireartro_preview` and `fireartro_production` and separate application database users with random unique passwords and least-privilege read/write roles for only their database.
- [ ] Do not use an owner/personal Atlas credential in the application. Do not include a password in `DB_NAME` or documentation.
- [ ] Because Vercel serverless egress is dynamic, show the user the security trade-off immediately before any broad Atlas network rule. If `0.0.0.0/0` is required, obtain explicit confirmation and rely on TLS, strong scoped credentials, least privilege, and credential rotation; never imply IP restriction exists when it does not.
- [ ] Invite `ebejerea@gmail.com` to the Atlas project with the minimum operational role after immediate confirmation.
- [ ] Save separate `MONGODB_URI` values to Vercel Preview and Production scopes without displaying them. Set corresponding `DB_NAME` values.
- [ ] Verify `GET /api/health` against Preview reports database/index readiness without revealing hostnames or credentials.
- [ ] Document a manual `mongodump`/`mongorestore` procedure and the limitation that M0 has no automated backup. Do not execute production backup operations under excluded point 13.

## Task 5: Create separate public Blob stores

**Files:**

- Create: `docs/runbooks/fireartro-blob-setup.md`
- Modify: `docs/runbooks/fireartro-environment-variables.md`

- [ ] After immediate confirmation, create separate public Vercel Blob stores for Preview and Production and connect each to the same Vercel project with environment scoping.
- [ ] Confirm Vercel injects `BLOB_READ_WRITE_TOKEN` server-side only. Record each public media origin as `VERCEL_BLOB_MEDIA_ORIGIN` in the matching scope.
- [ ] Verify Admin upload accepts only the existing allowed image/video types and returns a URL from the expected store origin.
- [ ] Verify Preview uploads never appear in the Production media list and vice versa.
- [ ] Confirm no Blob write token occurs in `REACT_APP_*`, build output, browser storage, or Admin responses.

## Task 6: Generate and install Admin production credentials

**Files:**

- Modify: `docs/runbooks/fireartro-environment-variables.md`
- Modify: `docs/runbooks/fireartro-production-ownership.md`

- [ ] Generate the single Admin username decision, a strong password, a valid bcrypt hash, and an independent random session secret locally without printing secrets into transcript output.
- [ ] Store the clear Admin password only in the owner-approved password manager shared with the two authorized administrators; never store it in Git or browser notes.
- [ ] Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` to Preview and Production using different hashes/secrets, after immediate confirmation.
- [ ] Set `CORS_ORIGINS=https://fireart.ro` in Production and only exact Preview/local origins where required.
- [ ] Keep `REACT_APP_BACKEND_URL` empty in Production so frontend and FastAPI use the same origin.
- [ ] Verify `/admin` rejects bad login, rate-limits repeated attempts, sets secure session/CSRF state, and returns `Cache-Control: no-store`.

## Task 7: Install the complete Preview and Production environment matrix

**Files:**

- Modify: `docs/runbooks/fireartro-environment-variables.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Reconcile all code-consumed variables against the runbook with an automated source search. Include MongoDB, Admin, CORS, Blob, Resend, Turnstile, Analytics, Google/Facebook review placeholders, and public contact fallbacks.
- [ ] Set Preview provider toggles safely: `RESEND_ENABLED=false`, `TURNSTILE_ENABLED=false` unless test keys are intentionally configured, no GA ID, and no review credentials.
- [ ] Set Production provider toggles initially disabled until their individual provider tests are complete.
- [ ] Never copy Production secrets into Preview. Never attach secret values to Development unless explicitly needed.
- [ ] After each variable group is saved, redeploy only Preview and verify the sanitized Admin Integrations panel reflects configured/not-configured state without values.
- [ ] Record variable names, scopes, and verification status only—not values—in the checklist.

## Task 8: Deploy and initialize Preview before touching production domains

**Files:**

- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] After immediate confirmation, deploy the feature branch to Preview and wait for build and function readiness.
- [ ] Verify `/api/health` is ready, `/api/content` loads, `/admin` authenticates, and the Admin bootstrap prompt appears only when no publication exists.
- [ ] Obtain immediate confirmation before pressing the one-time Admin initialization action.
- [ ] Initialize current defaults once, verify draft save, Preview, publish, public refresh, revision listing, and restore-as-draft. This proves future content changes update MongoDB and the public site without Git or redeployment.
- [ ] Verify a redeploy preserves published content and media references.
- [ ] Do not import customer data into Preview; use synthetic data only.
- [ ] Record the first publication/revision IDs in the runbook only if they are non-secret and contain no PII.

## Task 9: Configure Resend sending and receiving

**Files:**

- Use: `docs/runbooks/fireartro-resend-setup.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] In the `fireartro@gmail.com` Resend account, inventory the account/team and confirm whether `ebejerea@gmail.com` can be invited on the selected plan. Invite only after immediate confirmation.
- [ ] Create/verify the sending domain `fireart.ro` and add only the exact Resend SPF/DKIM records after comparing against the ROMARG DNS inventory.
- [ ] Create a restricted production API key suitable for sending and Receiving API access. Copy it directly once into Vercel `RESEND_API_KEY`; never display or store it elsewhere.
- [ ] Deploy the signed webhook code with `RESEND_ENABLED=false`. Then create one `email.received` webhook at `https://fireart.ro/api/webhooks/resend` and store its signing secret directly as `RESEND_WEBHOOK_SECRET`.
- [ ] Set sender, notification, inbound-domain, and inbound-address variables to the approved values. Keep sending disabled until domain verification succeeds.
- [ ] Inventory all current root-domain MX records before changing anything. Explain that Resend root MX receives every address at `@fireart.ro`; obtain a separate immediate confirmation before replacing/adding MX.
- [ ] Add exact Resend inbound MX and reconcile SPF/DMARC without creating duplicate/conflicting TXT records. Never delete an existing Google/Microsoft/custom MX record without explicit confirmation and a migration decision.
- [ ] Enable Resend only after sending and webhook tests pass. Verify quote alert, inbound `contact@fireart.ro`, Gmail relay once, Admin inbox once, and reply threading once.
- [ ] Test a message to another `@fireart.ro` address and confirm it is retained as `other_recipient`, not silently dropped.

## Task 10: Configure Cloudflare Turnstile

**Files:**

- Use: `docs/runbooks/fireartro-turnstile-ga4.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Under the FireArtRo-owned Cloudflare account, create distinct Preview and Production Turnstile widgets after immediate confirmation.
- [ ] Restrict Production hostnames to `fireart.ro` and approved redirect hosts only if the widget must render before redirect. Restrict Preview to the exact Vercel Preview hostname pattern supported by the dashboard.
- [ ] Store secret keys server-side as `TURNSTILE_SECRET_KEY` and public site keys as `REACT_APP_TURNSTILE_SITE_KEY`, with matching environment scopes.
- [ ] Enable Preview Turnstile and verify valid, expired, missing, duplicate, and provider-down behavior with synthetic quote data.
- [ ] Enable Production only after canonical domain and SSL are working. Verify the backend rejects a forged direct POST even if the widget UI is bypassed.

## Task 11: Create GA4 with consent-gated activation

**Files:**

- Use: `docs/runbooks/fireartro-turnstile-ga4.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] In the FireArtRo-owned Google Analytics account, create one GA4 property and Web Data Stream for `https://fireart.ro` after immediate confirmation.
- [ ] Invite `ebejerea@gmail.com` with the minimum role needed for analytics administration after immediate confirmation.
- [ ] Save the public Measurement ID as both the frontend build variable `REACT_APP_GA_MEASUREMENT_ID` and the sanitized server status variable `GA_MEASUREMENT_ID`; store no Google credentials.
- [ ] Deploy Preview first. Verify no Google request before consent, no request after “Doar necesare”, one initialization after analytics acceptance, sanitized SPA page paths, no `/admin`, and denied state after withdrawal.
- [ ] Confirm DebugView receives only approved public page-view data and no form fields, query strings, quote IDs, inbox paths, email addresses, or phone numbers.
- [ ] Activate the Production variable only after the legal copy and consent behavior are published.

## Task 12: Connect domains, redirects, DNS, and SSL

**Files:**

- Create: `docs/runbooks/fireartro-dns-inventory.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Capture a read-only ROMARG inventory for all six hostnames/domains: A, AAAA, CNAME, MX, TXT/SPF, DKIM, DMARC, CAA, verification records, and subdomains. Record values without authentication cookies or account identifiers.
- [ ] Add `fireart.ro` to the Vercel project as primary only after immediate confirmation. Add all five redirect hosts to the same project.
- [ ] Compare Vercel's exact requested DNS records with the inventory. Obtain immediate confirmation before each destructive replacement or conflicting record removal.
- [ ] Apply the minimum DNS changes. Preserve unrelated mail, verification, and subdomain records.
- [ ] Verify DNS resolution from multiple public resolvers, then verify valid TLS for all hostnames.
- [ ] Test 301/308 redirects for root and nested paths with query strings on every alias. Confirm canonical/OG/schema/sitemap remain `https://fireart.ro` after the redirect.
- [ ] Enable HSTS only after every included HTTPS hostname is valid and redirects correctly; do not submit preload as part of this scope.

## Task 13: Promote the verified code through the protected production path

**Files:**

- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Rebase or merge the latest remote `main` into the feature branch without destructive reset, resolve only intentional conflicts, and rerun all CI commands from both implementation plans.
- [ ] Review the pull request for secrets, `.env` files, build output, dependency directories, generated test artifacts, and accidental old-repository references.
- [ ] Obtain immediate confirmation before merging the pull request and triggering a Production deployment.
- [ ] Merge through GitHub's protected flow, allow Vercel to deploy `main`, and retain the previous healthy deployment as rollback target.
- [ ] Verify deployment build success, `/api/health`, public content, Admin login, persistent draft/publication, quote storage, Resend, Turnstile, GA consent, canonical URLs, redirect hosts, and SSL using only narrowly targeted acceptance checks.
- [ ] If a launch blocker appears, roll back with Vercel's previous deployment or a new `git revert` commit. Never use `git reset --hard` or force-push `main`.

## Task 14: Finalize the agreed handoff without entering excluded operations

**Files:**

- Modify: `docs/runbooks/fireartro-production-ownership.md`
- Modify: `docs/runbooks/fireartro-production-checklist.md`

- [ ] Confirm both authorized people have the intended access to GitHub, Vercel, Atlas, Resend where supported, Cloudflare, GA4, ROMARG, and the password manager. Record unsupported second-member limits honestly.
- [ ] Confirm 2FA and recovery ownership are checked without recording recovery codes.
- [ ] Confirm the owner knows the one in-app Admin login, draft/publication flow, quote inbox, email inbox, retry controls, media upload, and rollback contact path.
- [ ] Mark every included point 0–7 and 9–11 as complete only with current evidence. Keep points 8 and 12–15 visibly excluded, not accidentally marked complete.
- [ ] Commit the evidence-only runbook updates. Do not add credentials, screenshots with secrets, private URLs, customer data, or copied dashboard tokens.
- [ ] Stop before complete QA, operational monitoring/backups, launch-day marketing/search-console work, or post-launch maintenance because those points were explicitly excluded.
