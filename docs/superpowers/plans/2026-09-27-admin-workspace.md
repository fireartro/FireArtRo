# FireArtRo Compact Admin Implementation Plan

> **For agentic workers:** Use subagent-driven-development when account capacity permits, otherwise execute the same test-first steps inline. Track verified outcomes here; do not retry exhausted agents.

**Goal:** A compact editor over the real CMS, with automatic propagation of published content to open public pages.

**Architecture:** Preserve authenticated draft/publish/restore storage. Add a revision-only public API and a lifecycle-managed client watcher, plus same-browser revision notifications. Refactor only the Admin shell, collection editor, dashboard and login presentation.

**Tech Stack:** React 19, CRA, FastAPI, MongoDB, Jest, pytest.

## Global Constraints

- MongoDB remains authoritative. Admin autosaves only a draft.
- A publication atomically updates the public snapshot and its revision.
- Normal propagation target is roughly five seconds plus network time, not a guarantee during disconnection or server failure and not true push realtime.
- Never send drafts, credentials or private Admin data through the notification channel.
- Content updates must not remount an unchanged hero video.
- Four navigation groups: Pagini, Conținut, Solicitări, Setări.
- Touch targets stay at least 44px. No horizontal page overflow at 320px.
- Google/Facebook review setup remains last. No credentials guessed, recovered or reset.

## Task 1: Lightweight publication metadata

Files: backend/cms_repository.py, cms_service.py, cms_models.py, cms_routes.py; tests/test_cms_routes.py, test_cms_service.py.

Interface: `GET /api/content/revision` returns only `{revision_id, published_at}`, anonymous, with the same ETag and revalidation cache policy as public content. Mongo query projects only those two fields, never content or editor identity.

- [x] Add route tests: returns exact keys; unchanged ETag gives 304; saving a draft does not change it; publishing does; empty CMS gives 404.
- [x] Run tests and observe missing-route failures.
- [x] Add `PublicationRevisionResponse`, `get_publication_revision()` repository projection, service validation and route:

```python
document = await publications.find_one(
    {"id": CURRENT_PUBLICATION_ID},
    {"_id": 0, "revision_id": 1, "published_at": 1},
)
```

- [x] Run focused CMS route/service tests. Review response privacy and caching before committing this task.

## Task 2: Public synchronization lifecycle

Files: frontend/src/lib/contentApi.js, publicationSync.js, publicationSync.test.js; content/ManagedContentProvider.jsx and tests; admin/AdminDraftContext.jsx.

Interfaces: `fetchPublishedRevision({signal, revisionId})` returns revision metadata or null for 304. `watchPublications({getRevision, refresh, windowLike, documentLike})` returns a cleanup function; refresh resolves only after a confirmed public response. `announcePublication(revisionId)` emits a revision-only same-origin storage event for other tabs, never content.

- [x] Write fake-timer tests that prove a changed revision refreshes the real consumer, an unchanged revision does not; slow requests do not overlap; hidden/offline pages do not poll; return online checks immediately; errors back off and disposal aborts requests/removes listeners.
- [x] Run and observe missing implementation failures.
- [x] Implement one recursive timer, five-second healthy interval, sixty-second capped error backoff, AbortController and visible/online gating:

```js
const metadata = await fetchPublishedRevision({signal, revisionId: getRevision()});
if (metadata && metadata.revision_id !== getRevision()) await refresh();
```

- [x] Mount once in public provider; revalidate on route change without replacing video identity. Keep last good public snapshot on failures. Notify other tabs only after store.publish succeeds.
- [x] Run watcher, provider, content API, draft-store and video regressions before committing this task.

## Task 3: Compact editorial workspace

Files: frontend/src/admin/AdminLayout.jsx, AdminDashboard.jsx, AdminContentEditor.jsx, AdminLogin.jsx, AdminFeedback.jsx, admin.css; AdminLayout.test.jsx, AdminContentEditor.test.jsx, AdminLogin.test.jsx.

Interfaces: existing draft/session context contracts remain unchanged. Navigation keeps `?sectiune=` links; editor instance is keyed by module. Record selection and search are local to the current module.

- [x] Write tests for one shared publication control, four accessible groups, section navigation and search reset, record selection with real names, empty/no-match states, add/duplicate/reorder/delete-with-confirmation, and globally visible save errors outside dashboard.
- [x] Run to observe current behavior failures.
- [x] Replace filler dashboard with changed-module links, real last-publication time and useful shortcuts. Move integrations/legacy import into Settings section; preserve all operational modules.
- [x] Render collection entries as semantic list items containing buttons, with real thumbnails where available. Provide back-to-list action on mobile and editor heading for selected record. Keep errors and pending state visible in shared workspace.
- [x] Remove ornamental login orbit and marketing heading; retain username/password autocomplete, failed-password clearing and session behavior.
- [x] Apply compact dark design tokens and focused CSS overrides; fix mobile hidden text-only action buttons, sidebar close/Escape, focus return and inert background.
- [x] Run Admin tests and inspect 320/390/768/1440px widths, keyboard focus and expanded sidebar.

## Task 4: Canonical content and release gate

Files: docs/runbooks/fireartro-cms-operations.md and this plan; actual authenticated CMS through Chrome only for content changes.

- [ ] Inspect authenticated draft/publication diff before company/partner/gallery changes; preserve unrelated owner edits. If Chrome is still logged out, record blocker and do not invent a bypass.
- [x] Run full frontend tests, CMS tests, artifact/API tests, production build and git diff --check.
- [x] Verify two public pages update after a publication using isolated local fixtures without changing production content. Verify unchanged hero element identity.
- [ ] Review code and requirement coverage; commit only task-owned changes. Deploy only verified changes using the established deployment workflow. Report live content migration separately if authentication is still required.

## Progress

2026-09-27: Tasks 1–3 implemented. Regression tests covered both defects found by the UI reviewer: filtered renaming must retain the selected ID; undoing the sole new record must restore the mobile list. Native Chrome verified 320/390/768/1440px layouts, menu isolation and two already-open public pages updating after an isolated local publication. Hero identity/time preservation is additionally covered by a real-component provider test.

Fresh verification: 319 frontend tests; 353 backend tests (10 external-service tests skipped); 16 Node API/preview tests; 19 production artifact tests. Production build succeeds. Direct editing without clicking a filtered row is additionally covered: focus/change capture pins the stable record ID before a field mutation. The final read-only reviewer reported no Important/Critical findings. The detached loopback-only CMS QA process was stopped and never accessed private production drafts or credentials.

Production content migration remains blocked: Chrome Admin is logged out. The published snapshot still contains the previous company identity and twelve untouched partner seed entries. Existing compatibility overlays are deliberately not presented as a canonical Admin migration. Correct company/legal paragraphs and real partner/logo records must be published through the authenticated CMS while preserving unrelated owner edits. No credentials were guessed or reset. Google/Facebook review configuration remains deferred.

Earlier partner/scroll/gallery work is preserved and tested separately. Release status will be recorded after integration/deployment confirmation.
