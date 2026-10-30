# Site polish, 30 October 2026

The requested result is a mobile logo 10 percent larger, a photographic startup reveal finished within 1.5 seconds when the first hero is ready, the former scroll-driven partner scene with the current catalogue, resilient media resume, and readable laptop scaling independent of OS.

Implementation: preserve the current production branch and CMS/security behavior; carry over the verified HD/UHD film assets. Replace synthetic startup canvas with a small real-footage excerpt. Keep startup locked only while the first playable hero is genuinely pending, with accessible retry/entry recovery. Restore the original three spherical partner ribbons, including perspective, rotation and assembly at scroll. Project whole DOM cards instead of duplicating canvas labels; distribute all 26 partners across the actual ribbon populations. Prioritize front cards at intersections and protect the central title. Provide pause, a complete list and a mobile/reduced-motion grid. Detect a stalled video decoder after foreground return and recreate its media element at the same chapter/time. Expand desktop type/control baselines at common MacBook CSS viewports rather than multiplying by Retina DPR.

Checks: failing readiness/decoder tests first, complete frontend/API/artifact checks, visual inspection on phone/laptop/tablet and Chromium/WebKit, actual frame progression after lifecycle transitions, all partner links/logos/layout, final commit and push to fireartro/FireArtRo on a codex branch. No force push or production merge.

## Verified result

- Mobile logo height and width limit increased exactly 10 percent; measured against the previous rules in the browser.
- Real fireworks startup clip (2.3 s, 1280 x 720, under 1 MB); overlay and fade finish by 1.5 s when ready. Late readiness shortens the exit fade. A slow first hero remains covered until ready or explicit manual entry.
- Original orbital movement restored with current partner names/logos. One frame contains its logo and caption. All 26 partners become visible during a full rotation without intersecting the heading or another visible frame. Infinity Ballroom and Palat Ioan Festeleu retain the catalogue's name-only presentation because no verified logo is supplied.
- Page visibility, page restoration, stalled clocks and stalled decoded frames recover playback at the saved chapter/time. Browser assertions compare decoded pixels, not only currentTime.
- Common 1024–1599 px laptop viewports use an 18 px base (when at least 650 px tall), with larger navigation and branding. Rules are independent of operating system and pixel density.
- All 12 clean 30-second HD/UHD film assets are included in Git. Public/build SHA-256 hashes match the previously fully decoded masters. Master edits and source limits are documented in `scripts/hero-film/REVIEW.md`.
- A production stylesheet's 220 ms opacity transition was reproduced at chapter handoff and overridden specifically for the montage; the decoded next chapter appears immediately without a poster flash.

| Validation | Result | Local evidence under `output/site-polish/` |
| --- | --- | --- |
| Frontend unit tests | 66 suites, 443 passed | `unit-verified.log` |
| API/deployment checks | 53 passed | `api-verified.log` |
| Build/artifact/startup checks | 29 passed | `artifacts-final-delivery.log` |
| Chromium/WebKit responsive, lifecycle, framing and partner flows | 32 passed, followed by both corrected handoff checks passing | `browser-verified.log`, `handoff-verified.log` |
| Mobile Chrome/WebKit startup and decoder recovery | 6 passed | `mobile-verified.log` |
| Production build | Compiled successfully | `build-final-delivery.log` |
| Delivered media identity | All 12 public/build hashes match | `media-hashes.json` |

Preview: `http://127.0.0.1:4188`, with the public CMS snapshot and bundle `main.dac85e40.js`. Intro and orbit screenshots are in the evidence directory. Browser/device checks use Chromium and WebKit with viewport/DPR/mobile emulation; a physical MacBook/iPhone was not available. This branch does not itself merge or publish production.
