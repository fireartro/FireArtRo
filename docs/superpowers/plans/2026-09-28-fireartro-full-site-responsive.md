# FireArtRo Full-Site Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public FireArtRo route and the Admin workspace legible, balanced and functional at 2560 CSS px, without regressing 4K, Full HD, tablet, phone or landscape layouts.

**Architecture:** Keep the Night Runway design. Establish one fluid visual-content width and role-based type scale, then adjust the home scenes, non-home routes and Admin within their own stylesheets. Browser geometry and interaction tests are the acceptance gate; readable prose retains its existing narrow max-width.

**Tech Stack:** React 19, CRA/CRACO, CSS, Jest/React Testing Library, Playwright.

## Global Constraints

- Baseline: `fireartro/main` commit `d559f18`, design spec `docs/superpowers/specs/2026-09-28-fireartro-responsive-layout-design.md`.
- Preserve current brand, content, media, opposite-moving partner bands, route flows and Admin data/API behavior.
- Check every public route plus `/admin` at 2560×1440 CSS px; also test 320×568, 375×667, 390×844, 667×375, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080, 2560×1700 and 3840×2160.
- The 2560 CSS-pixel preview's DevTools "Fit to window" shrinkage is not CSS shrinkage. Fix measured layout caps and text, not the browser preview.
- Do not use global `zoom`, `transform: scale`, a global root-font-size multiplier or a 4K video upsample. Keep readable paragraphs/Blog articles/Legal text narrow even when visual grids widen.
- Use test-first changes: write a browser/component assertion for each layout contract, watch it fail on the baseline, then implement and verify green. Preserve existing test intent while replacing obsolete 1440 px shell-cap assertions.
- Existing baseline verified on 2026-09-28: 57 frontend suites, 333 tests passing; production build passes. Preserve untracked partner images in the separate `fireartro-production-setup` checkout.

## File ownership and task order

Task 1 owns `night-runway.css`, `navigation-prominence.css`, `night-footer.css`, and the existing shared scale test. Task 2 owns only home CSS, `PartnerCloud.jsx` and its tests. Task 3 owns only non-home public CSS and a new public-route scale test. Task 4 owns `admin.css` and its isolated layout test. Task 5 owns the final cross-route matrix and integration review. Task 1 establishes the fluid-width interface before Tasks 2–4; after that, Tasks 2–4 have disjoint edit sets and may be delegated in parallel at the user's request.

### Task 1: Shared width, type, navigation and footer

**Files:**
- Modify: `frontend/src/styles/night-runway.css`, `frontend/src/styles/navigation-prominence.css`, `frontend/src/styles/night-footer.css`
- Test: `frontend/e2e/night-runway-fluid-scale.spec.js`

**Interfaces:**
- Produces CSS custom properties `--nr-layout-max`, `--nr-cinematic-content-max`, `--nr-type-label`, `--nr-type-small`, `--nr-type-body`, `--nr-type-lead` for all later tasks.
- Keeps `.nr-readable` capped at `72ch`; later tasks may give visual components local widths.

- [ ] **Step 1: Make the current shared-width test fail for the right reason.** In the existing `scaleCases`, require at 2560×1440 `shellMin: 1800`, `navMin: 18`, `bodyMin: 19`, and at 3840×2160 `shellMin: 2100`, `navMin: 20`, `bodyMin: 20`. Replace the hard-coded shell `<=1441` assertion with `<=2224`, including the second public-route test's now-obsolete maximum for visual features. Leave the 1512 and 5120 cases coherent with these bounds. Add a separate 2560×720 assertion that body text is at least 18 px and the shared display title fits within the available viewport height. Run the test against the existing build and record the expected failed assertions.

  ```powershell
  npx.cmd playwright test e2e/night-runway-fluid-scale.spec.js --project=desktop-chromium
  ```

- [ ] **Step 2: Implement the shared fluid tier.** Replace the fixed `--nr-layout-max: 90rem` with `clamp(90rem, 75vw, 138rem)`. Let `--nr-cinematic-content-max` grow to at most `150rem`. Make body/small/label tokens respond to viewport width rather than shrinking on short-landscape height; at 2560×1440 body must reach at least 19 px and label at least 14 px, with a phone floor of 16 px body. Preserve `.nr-readable`. Rebalance `.site-navbar-layout` link groups at wide widths so the logo remains centered while link groups are not crowded against it. Do not change mobile menu behavior. Expand the shared footer's visual columns and PNRR artwork without stretching its legal prose or breaking the 721 px transition.

  ```css
  --nr-layout-max: clamp(90rem, 75vw, 138rem);
  --nr-cinematic-content-max: clamp(90rem, 84vw, 150rem);
  --nr-type-body: clamp(1rem, calc(.75rem + .28vw), 1.35rem);
  ```

- [ ] **Step 3: Build, rerun the focused browser test, and commit.** Check 1440, 1920, 2560, 3840 and 2560×720 native-size layouts. Run `yarn.cmd build`, then the focused Playwright test. Commit only Task 1 files.

### Task 2: Homepage scenes, hero, package selector, partner bands

**Files:**
- Modify: `frontend/src/styles/night-home.css`, `frontend/src/styles/home-package-selector.css`, `frontend/src/styles/night-home-film.css`, `frontend/src/styles/night-partners.css`, `frontend/src/components/night/PartnerCloud.jsx`
- Test: `frontend/e2e/night-runway-home.spec.js`, `frontend/e2e/night-runway-partners.spec.js`, `frontend/src/components/night/HomePartners.test.jsx`

**Interfaces:** Consumes Task 1's shared tokens. Does not modify shared CSS or public-route CSS.

- [ ] **Step 1: Write failing geometry tests at 2560×1440 and 3840×2160.** Probe `.fa-packages--selector .fa-packages__inner` for at least 1600 px at 2560, `.fa-work` featured panel for at least 1700 px, and homepage About/partner/footer content for balance and no horizontal overflow. For partner bands, assert each moving `.fa-partner-lane__group` is at least as wide as its lane at 3840 and still has opposite directions; assert the reduced-motion fallback remains scrollable. Run the focused browser/component tests and observe the intended failures.

- [ ] **Step 2: Expand home compositions without enlarging prose columns.** Make the package selector fluid from its current 1120 px cap to approximately 1600–1760 px on wide screens; proportionally increase its heading, category labels and image scene. Increase the home gallery panel/figure from their current 1344/1152 px caps toward a roughly 1900–2100 px visual panel on 2560–3840 screens. Give About enough compositional width without making its body paragraphs longer than 72ch. At ≤759 px, raise the hero description from `0.78rem` and CTA text from `0.57rem` to legible values, preserving two visible CTAs; guard 1000–1024 px short landscape against gallery-figure clipping. Tune hero copy position and video object-position per orientation but keep the selected montage files and loading behavior unchanged.

  ```css
  @media (min-width: 1600px) {
    .fa-packages--selector .fa-packages__inner { max-width: min(68vw, 110rem); }
    .fa-packages__scene { height: clamp(28rem, 30vw, 37rem); }
  }
  ```

- [ ] **Step 3: Fill wide partner lanes with real repeated partner entries, not blank CSS padding.** Keep one accessible original list per lane and mark decorative copies hidden from assistive technology. Determine the number of decorative items from the actual lane width on mount/resize so either lane is covered at 3840 even when Admin supplies fewer partners. Keep pause/visibility/reduced-motion controls and no duplicated spoken names. Increase card/logo presentation enough to read at 2560 without inflating phone cards. Test a short partner list as well as the default 26.

- [ ] **Step 4: Run component tests, build, focused browser tests and commit only Task 2 files.** Verify the hero, package selector, gallery scenes, bands and About visually at phone, landscape, 2560 and 3840 before committing.

### Task 3: Packages, Gallery, Contact, Blog, FAQ and Legal routes

**Files:**
- Modify: `frontend/src/styles/night-packages.css`, `frontend/src/styles/night-gallery.css`, `frontend/src/styles/category-navigation.css`, `frontend/src/styles/night-contact.css`, `frontend/src/styles/night-blog.css`, `frontend/src/styles/night-faq.css`, `frontend/src/styles/night-legal.css`, `frontend/src/styles/package-video-playlist.css`
- Test: `frontend/e2e/night-runway-route-scale.spec.js` (new)

**Interfaces:** Consumes Task 1's shell/type tokens; must not broaden `.nr-readable` or article/legal prose. The new route-scale test leaves Task 1's shared test and Task 5's matrix untouched.

- [ ] **Step 1: Add failing 2560-wide route probes.** Create `night-runway-route-scale.spec.js` covering `/pachete`, `/galerie`, `/intrebari-frecvente`, `/contact`, `/blog`, `/confidentialitate`, `/termeni-si-conditii` and `/cookies` at 2560×1440. Assert each route's heading, body and principal visual block is visible, readable, within its viewport and free of horizontal overflow. Keep narrower maximums for Legal/FAQ/article reading columns; do not mistake intentional readable widths for defects. Add a short-landscape category-navigation check and a 375 px contact-form check. Run RED.

- [ ] **Step 2: Implement route-specific wide layouts.** Enlarge visual/media grids and presentation in Packages, Gallery and Blog archive using Task 1's shell. Keep Legal, FAQ, Blog article and Contact explanatory prose readable while scaling headings, controls, cards and surrounding composition. Bring package video playlist labels above their current 12–14 px wide-screen ceiling. Use `overflow-wrap: anywhere` for long CMS Blog headings. At 375 px make Contact date/select fields one-per-row; at short landscape keep package/gallery categories compact enough that content is reachable without a screen of filters.

  ```css
  @media (max-width: 600px) {
    .nr-contact-fields, .nr-contact-optional__fields { grid-template-columns: minmax(0, 1fr); }
  }
  .fa-blog-card h2, .fa-blog-article h1 { overflow-wrap: anywhere; }
  ```

- [ ] **Step 3: Run route/component tests, production build and focused Playwright tests; commit only Task 3 files.** Check interactions: package prefill, Gallery lightbox/filter, FAQ accordion, Blog navigation and Contact validation. Preserve route URLs and data contracts.

### Task 4: Admin responsive workspace

**Files:**
- Modify: `frontend/src/admin.css`
- Test: `frontend/e2e/night-runway-admin-responsive.spec.js` (new)

**Interfaces:** No Admin auth/API/schema change; tests may use an isolated static `.cms-shell` fixture with the real CSS, so they can run without production credentials.

- [ ] **Step 1: Write a failing computed-layout browser test.** Load the real `admin.css` into a small `.cms-shell .admin-workspace` fixture. At 900, 901, 1050 and 1051 px assert the 901–1050 drawer mode has a single content column and a closed off-canvas sidebar; at 2560 assert the workspace and main controls use available width and readable text. Confirm RED at 901–1050.

  ```js
  const columns = await page.locator('.cms-shell .admin-workspace').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);
  ```

- [ ] **Step 2: Fix the later `.cms-shell .admin-workspace { grid-template-columns: 220px minmax(0, 1fr) }` override with an equally specific drawer rule at `max-width: 1050px`.** Raise the Admin's 9–14 px utility labels and controls on wide screens without increasing density excessively; keep its phone/tablet editor responsive. Do not treat its internal 430/834 px preview wrapper as a genuine viewport test.

- [ ] **Step 3: Run Admin component tests, the focused layout test and build; commit only Task 4 files.** If a live Admin session becomes available, verify the actual drawer/editor at the same breakpoints, but the test cannot require credentials.

### Task 5: Full-site integration and verification

**Files:**
- Modify: `frontend/e2e/night-runway-responsive-matrix.spec.js` only if new coverage is needed for article/Admin/short landscape; do not weaken the existing no-overflow assertions.
- Record: final test/build/browser findings in the implementation handoff, not a new runtime file.

- [ ] **Step 1: Run focused and full suites.** Run `CI=true yarn.cmd test --watchAll=false --runInBand`, `yarn.cmd build`, `npx.cmd playwright test e2e/night-runway-fluid-scale.spec.js e2e/night-runway-route-scale.spec.js e2e/night-runway-responsive-matrix.spec.js e2e/night-runway-admin-responsive.spec.js --project=desktop-chromium`, then broader available browser projects as practical. Compare against baseline 57 suites/333 tests.
- [ ] **Step 2: Browser-check every route at 2560×1440, then the full matrix in the design spec.** Capture actual CSS sizes, bounding boxes and screenshots at native scale, inspect long pages beyond the first viewport, and exercise navigation, filter/lightbox, CTA/form and reduced-motion flows. Separate source-video softness (1920×1080 input) from CSS scaling defects.
- [ ] **Step 3: Request final independent branch review, fix load-bearing findings, and hand off.** Confirm no unexpected files, secrets or media additions. Report exact verified sizes/browsers and any unverified hardware-specific limitation; do not claim every device or refresh rate was physically tested.
