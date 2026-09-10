# Owner revision — September 9, 2026

## Approved direction and constraints

Implement the owner's eight requested changes and the mobile screenshot feedback,
alongside the measured landing scroll correction. Preserve FireArt's approved
dark, blurred atmosphere, typography and cinematic title treatment. Use existing
owned media only, no paid generation. All editable public content stays in the
draft/publish CMS. Do not remove originals, reset user changes or touch old Git.

### Deliverables

1. Hero: full formations rather than aggressively cropped fireworks/drone photos;
   curate intense night/day fireworks and drone moments, no visible names/logos.
   Keep independent phone/tablet/desktop framings, responsive kinetic titles,
   reduced-motion behavior and one efficient download at a time.
2. Landing: clearly name Artificii de noapte, Artificii de zi, Spectacole de drone
   and other effects; fireworks precede drones in descriptive public copy.
3. Landing packages: category-specific images and links to each package range,
   not three unrelated featured price cards. The destination exposes packages
   and each package's existing CMS-managed primary and additional YouTube URLs.
4. Packages and gallery: large visible category panels on phones, night fireworks
   first. No horizontal clipped category navigation. Distinct selection, keyboard
   access, readable contrast and no duplicated video preview.
5. Gallery: exclude photographs containing drone-written names, places or logos;
   visually inspect, don't infer solely from filenames. Preserve library originals.
6. Public descriptive order: show-uri de artificii profesionale, show-uri de drone
   și alte efecte pirotehnice. Preserve legal company statements and factual content.
7. FAQ booking: recommend contacting as early as possible as dates fill; early
   reservation improves availability. Duration: usually 2–15 minutes, depending on
   show type, budget, preferences and location. Price: location, duration, lead time,
   show type, effects, preferences, safety and logistics (no drone count).
8. Rendering: one bounded atmospheric layer across gallery/packages/about, no
   page-height filtered fixed background or duplicated fixed gallery background.

## Implementation / verification plan

- [x] Category UI + homepage range cards, selected package video lists and deep links.
  Files: HomePackages.jsx, Packages.jsx, GalleryPage.jsx, scoped category CSS and
  helper/tests. Use existing `imageMediaId`, `videoUrl`, `moreVideoUrls`, category.
  Test URL-selected categories, keyboard selection, video list changes, empty cases.
- [x] Shared bounded homepage background. HomeRunway.jsx/night-home-film.css.
  First reproduce failing viewport-bound/seam contract in Chrome; after fix measure
  same instant-scroll foreground 390x844/4x CPU test. Keep hero and copy unchanged.
- [x] Curate assets visually and revise the existing 32-second composition from
  source rather than re-encoding delivered video. Test all profile bounds, render,
  probe duration/codecs/dimensions and inspect representative frames before promotion.
- [ ] Update CMS defaults and published draft safely. Capture existing revision;
  merge only requested fields and visibility flags; don't overwrite unrelated draft
  edits. Existing Admin publication workflow remains authority for live content.
- [x] Run affected regression tests, full frontend suite, build and artifact/API
  tests; review scoped changes independently. Inspect desktop/tablet/phone, routes,
  package links, keyboard access, no unwanted labels in gallery, and FAQ copy.
- [ ] Commit only approved files, normal push to fireartro/FireArtRo main, confirm
  Vercel production readiness and published content on fireart.ro. Update this
  checklist with actual evidence and explicitly record any remaining blockers.

## Work ledger

Baseline: 05520416ca3bc05a743b539c06846df909990b6f, branch codex/pagespeed-performance.
Preserve unrelated scripts/render-responsive-hero.ps1 and scripts/prepare-cinematic-hero.cjs.
Read-only diagnosis: output/landing-diagnostic-2026-09-09.md.

### Verification so far (September 9–10)

- Local frontend: 42 suites / 212 tests passed. Production build succeeded.
- API/deployment configuration: 14 tests passed; public artifacts: 10 passed.
- Staged owner content validates against backend `SiteContent`: 207 media records,
  8 packages, 10 FAQs. No unpublished draft edits existed (version 4, publication
  a14051dc-3ddd-46f8-91c8-67b27b169cd6). No legal/contact/auth fields changed.
- Gallery selection: inspected 205 photographs; 73 explicitly hidden, 132 remain.
  Original files stay available. Admin tag help documents `ascuns-din-galerie`.
- Chrome 390x844: packages and gallery category controls are 72px tall, no
  horizontal overflow; night first. Selecting day displays Multicolor and all
  14 videos. Package video lists are expanded initially.
- Background after correction (foreground Chrome, 390x844, 4x CPU, identical
  instant-scroll interval): two runs had 8 and 6 frames over 33.4ms, versus
  38–41 before. P95 improved to 27.8/21ms; median 13.9ms. This is a controlled
  local diagnostic, not a guaranteed device FPS or a PageSpeed score.
- Desktop gallery/packages boundary visually inspected: continuous atmosphere.
  Background paint surface is viewport-sized instead of the former 7455px layer.
- Six 32-second / 24fps masters rendered from owned originals with full-fit
  framing. Representative phone/desktop frames inspected, including day/night
  fireworks and drones. Responsive text animations retained; fireworks first.
- Delivery validation now applies the same VMAF >=95 threshold to H264 and AV1.
  Rejected candidates remain in ignored output; no originals were removed.
- Eight responsive category-image derivatives added, keeping exact originals for
  large displays and leaving future Admin upload URLs untouched.
- Independent review agent was unavailable due to account quota; main agent
  reviewed the implementation, CMS merge boundaries and CSS loading scope.
- Chrome reconnected on September 10. Final local phone category cards inspected:
  all four use the intended responsive photographs, with no horizontal overflow.
- All six final AV1/H264 pairs passed the clarity threshold against their rendered
  master (VMAF 95.05–95.95). AV1 is 30.3–42.4% smaller than the quality-matched
  H264 fallback. Matching assets and posters promoted together before final build.
  These metrics describe compression fidelity, not a lossless guarantee.
- Final build succeeded with main.3ad5c984.js; 42/212 frontend, 14 API and 10
  artifact tests passed after all final assets were promoted. One artifact run
  overlapped the build and saw incomplete output; the post-build run passed.
- Desktop 1440x900 category card grid visually inspected in Chrome. The staged
  live draft was rechecked: still version 4, with no unrelated unpublished changes.
- Landing package range cards refined after owner feedback: photography is in a
  dedicated panel above the copy, ordinal/count messaging is removed, and every
  card now uses the action label “Vezi mai multe opțiuni”.

| Profile | AV1 MiB | H264 MiB | AV1 VMAF | H264 VMAF |
| --- | ---: | ---: | ---: | ---: |
| Wide | 16.89 | 26.73 | 95.56 | 95.31 |
| Ultrawide | 12.86 | 20.21 | 95.34 | 95.14 |
| Tablet landscape | 12.82 | 18.39 | 95.51 | 95.05 |
| Tablet portrait | 14.76 | 25.63 | 95.06 | 95.76 |
| Mobile | 13.01 | 20.25 | 95.44 | 95.95 |
| Mobile tall | 12.85 | 20.13 | 95.38 | 95.82 |

### Still to finish

- Commit/push the scoped revision, wait for production deployment, then publish
  the owner CMS revision and verify it. Do not report a live update before this.
- Final Chrome live inspection after browser reconnection.
