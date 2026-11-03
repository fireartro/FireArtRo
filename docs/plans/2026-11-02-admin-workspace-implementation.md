# FireArtRo admin workspace implementation plan

> **For agentic workers:** Execute this plan inline, task by task, using the test-driven-development and verification-before-completion skills. The user has approved the recommended design and implementation; no further design approval is pending.

**Goal:** Give the owner a compact Romanian admin with visual media selection and independently saved responsive image framing that is faithfully rendered on the site.

**Architecture:** Optional, validated presentation metadata lives on each placement. Shared pure functions produce responsive CSS variables for both the editor preview and public components. Existing draft, publication, authentication and media storage workflows stay authoritative.

**Tech Stack:** React 19, existing Radix dialogs and Lucide icons, CSS, FastAPI/Pydantic, generated JSON Schema/Zod, Jest/pytest/Playwright. No new runtime dependency.

## Global constraints

- Romanian UI; existing dark FireArtRo identity and blue accent.
- Preserve old documents and unchanged public visuals; no source-image exports or media uploads for framing.
- Independent desktop, tablet and phone settings; keyboard alternatives to dragging.
- Preserve authentication, conflict handling, draft autosave and explicit publication.
- Local QA uses an isolated public snapshot; never change live business content to test.

### Task 1: Validated responsive presentation contract

Files: backend/cms_models.py, backend/tests/test_cms_models.py, frontend/src/content/siteContent.schema.json, frontend/src/content/managedContentSchema.js and its tests.

- [x] Add failing backend tests for optional placement data, finite numbers, bounds, unknown properties and an old document round trip.
- [x] Run pytest against those cases and confirm the new fields are rejected before implementation.
- [x] Add ImageFrame (x/y 0–100, zoom 1–3, fit cover/contain, optional ratio 0.4–3), ResponsiveImageFrame (desktop, optional tablet/phone) and HomeCategoryVisual (category, mediaId, frame). Attach optional imageFrame to media, package and promo-slide placements; attach optional packageVisuals to HomeContent.
- [x] Generate frontend contract with SiteContent.model_json_schema(); retain omitted optional properties when absent so old content comparisons remain stable.
- [x] Verify backend and frontend accept/reject the same fixture:

```js
{ desktop: { x: 50, y: 30, zoom: 1.2, fit: 'cover', ratio: 1.5 }, phone: { x: 65, y: 40, zoom: 1, fit: 'contain' } }
```

### Task 2: Shared framing and public selection

Files: new frontend/src/lib/imageFrame.js, its tests, new framing stylesheet, HomePackages.jsx, HomeGallery.jsx, Packages.jsx, GalleryPage.jsx, homeMediaSelection.js and regression tests.

- [x] Write failing tests proving an explicit homepage category selection overrides the legacy default and a promo-slide frame remains attached to the selected media.
- [x] Implement getFrame(value, device), frameVariables(value), frameImageStyle(value, device), with finite guarded defaults. Frame ratio is optional and inherits the existing surface geometry when unset.
- [x] Render frame CSS variables with the same desktop/tablet/phone breakpoints; integrate on each image placement without changing the original file URL, responsive source selection, alt text or full-image lightbox.
- [x] Respect explicit homepage selections. For default content preserve existing selection and duplicate avoidance. Show a warning in the owner editor for repeated explicit choices.
- [x] Run focused public-component and helper tests.

### Task 3: Visual selector and framing editor

Files: new admin/AdminMediaPicker.jsx, admin/AdminImageFrame.jsx, admin/AdminHomeVisuals.jsx and their tests; AdminField.jsx, adminConfig.js.

- [x] Write failing interaction tests for search/category filtering, correct selection, device inheritance/unlink, reset/copy, keyboard values and independent placement persistence.
- [x] Add a Radix-backed visual media picker using existing draft.mediaItems, lazy thumbnails and accessible named buttons. Filter image-only placements appropriately.
- [x] Add a frame editor that previews the actual source, sets position/zoom/ratio/fit, supports pointer capture drag, keyboard sliders and numeric inputs, and commits a drag as one undoable update.
- [x] Add explicit homepage category visual controls, promo-slide frame controls and package/gallery frame controls. Keep technical IDs out of the normal flow.
- [x] Match source resolution and the existing card overlays/shape in previews; display file errors and an accessible empty selection.
- [x] Run targeted editor tests, then verify saved draft values survive the store's save/reload cycle.

### Task 4: Compact admin shell and workflows

Files: AdminLayout.jsx, AdminDashboard.jsx, AdminContentEditor.jsx, AdminField.jsx, AdminMediaLibrary.jsx, new admin-workspace.css, AdminWorkspace.test.jsx and focused tests.

- [x] Write failing tests for section search, collection filtering, grouped forms, true undo availability and a single primary publication action.
- [x] Keep all operational modules. Add searchable navigation, meaningful current-section identity and responsive action labels.
- [x] Use compact list/form proportions and sticky collection controls. Group page sections, SEO and advanced data; automatically expose groups containing validation errors.
- [x] Give the dashboard real navigation, publication changes and useful editing entry points. Add media library search/type/status filters without extra network fetches or fictional metrics.
- [x] Preserve the mobile list/editor transition and dialog focus return. No UI action may silently edit a different collection record.
- [x] Run all existing admin tests and fix real regressions.

### Task 5: Responsive preview and end-to-end persistence

Files: AdminPreview.jsx, related preview route if needed, App routing, admin preview tests, Playwright CLI browser QA scripts (local output), local QA harness.

- [x] Verify responsive preview uses the selected viewport rather than only a narrow div while media queries still read the outer desktop viewport. Fix this with an authenticated isolated iframe preview when required; transfer draft only to the same-origin verified child, never query strings or storage.
- [x] Test 320/390/768/1280/1920 widths, changing a homepage selection, per-device positioning, saving/reloading, undo, full preview and a local publication/restore.
- [x] Test keyboard media choice, keyboard frame editing, Escape/focus return, invalid input recovery and empty collections.
- [x] Capture full editor screenshots on desktop and phone and inspect them for clipping, overflow, unreadable text and false previews.

### Task 6: Finish and release

- [x] Run full backend/frontend/API/artifact suites and production build once the implementation stabilizes.
- [x] Run Impeccable's mechanical detector over changed UI files and address mechanical findings.
- [x] Perform independent visual finish review with the approved brief, screenshots, diff and craft-floor evidence; correct material findings.
- [ ] Commit the complete validated change and push to main as previously authorized. Confirm GitHub checks, Vercel Ready, current production assets and a read-only live admin/endpoint check.

## Plan self-review

The six tasks cover the approved design. Optional properties preserve old snapshots. Public behavior and editor previews share the same framing functions. Existing API credentials and live content are not prerequisites for local admin tests. Image files remain unchanged; the new data controls presentation only.
