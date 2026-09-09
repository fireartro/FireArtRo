# FireArtRo performance release — 2026-09-09

## Scope and destination

User-approved 32-second cinematic film, unchanged edit, colors, original imagery,
six framings and animated copy. Deployment target: existing Vercel project
`capital-european/fireartro`, repository `fireartro/FireArtRo`, production `main`,
canonical domain `https://fireart.ro`. Previous production commit: `56d2eb2`.
The old repository, account settings, plans and published CMS content are untouched.

## Changes

- The public CMS request starts from the document head, in parallel with JS/CSS,
  instead of waiting for the React application. Anonymous, same-origin, no-cache;
  one-time bootstrap consumption, validation still performed by the provider.
  Admin is excluded from prefetching; drafts never enter this path.
- Requested public route chunks preload in parallel with the snapshot. Home and
  Admin previews are lazy, so interior visits do not load homepage animation code.
- Gallery retains its full mosaic, filters and full-resolution lightbox, but only
  the initial eight thumbnails are eager; the rest use native viewport loading.
- Kinetic text avoids redundant DOM style writes when media time is unchanged.
  Existing pause, hidden-tab, reduced-motion and offscreen behavior is preserved.
- One responsive video file is selected before mounting. Smaller AV1 is used only
  with supported, smooth, power-efficient decoding; H264 remains the fallback.
  Capability timeout is 200ms, bounded behind the poster; decoder errors recover
  to H264 rather than leave a blank surface. Custom Admin video remains supported.
- New video and poster cache token: `20260909-cinema`. Source dimensions, 24 fps,
  768 frames and 32-second duration unchanged. MP4 metadata precedes media data.

Browser capability reference: [MDN decodingInfo](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo).

## Measurement boundaries

Baseline fresh Chrome visit: `/api/content` ~3140ms; first contentful paint ~1056ms
was the loading message, not the final hero. Server cold-start latency remains an
external variable; this release overlaps requests instead of introducing stale
CMS edge caches. No claimed universal PageSpeed score or field-CWV improvement.

Comparisons for compression are against the **approved v3 H264**, not the older
lower-resolution 20-second live movie. AV1 is lossy: no claim of bit-identical
compression. Full-film VMAF and visual crops of firework trails and drone lights
are checked; the source masters and compatible H264 remain unchanged.

## Verification record

Full-film delivery measurements (MiB, 1 MiB = 1,048,576 bytes):

| Composition | Approved H264 | AV1 | Smaller | VMAF vs master |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 22.38 | 14.67 | 34.5% | 95.17 |
| Ultrawide | 18.20 | 12.17 | 33.1% | 95.23 |
| Tablet landscape | 16.83 | 13.70 | 18.6% | 95.63 |
| Tablet portrait | 14.64 | 12.63 | 13.7% | 95.47 |
| Phone | 9.12 | 8.49 | 7.0% | 95.42 |
| Tall phone | 10.54 | 9.71 | 7.8% | 95.60 |

H264 delivery bytes are unchanged from the approved local edit. AV1 benefits
only compatible efficient decoders; phones deliberately use gentler compression.
The quality gate is not a PageSpeed score or a mathematical lossless guarantee.

- Frontend: 38 suites, 198 tests passed, including codec selection/fallback,
  CMS bootstrap/revalidation, responsive video, gallery and Admin behavior.
- Node/API: 14 tests passed.
- Independent bounded review completed; the selected-codec support issue was
  fixed and protected by a regression test.
- Media measurements are generated in ignored
  `output/fireart-cinema/delivery-2026-09-09/quality-report.json`.
- Production build passed; main JavaScript is 150.58 kB gzip (594,869 bytes raw),
  with homepage and Admin preview chunks excluded from the initial entry point.
- All 10 final artifact checks passed (bundle budgets, icons, metadata, robots,
  canonical domain, structured data and public bootstrap).
- Chrome local checks: desktop 1920x1200 movie and phone 720x1560 movie both
  decode and play the 32-second AV1 delivery; responsive titles are visible and
  clear of CTAs. Only the selected video is requested. Gallery: 205 images,
  8 eager and 197 lazy, with 8 loaded at initial mobile viewport. Full-size
  lightbox opens; the empty contact form reports required-field errors without
  submitting. No app errors observed; extension warnings are unrelated.
- Live deployment verification remains the final release gate.

## Reproduction / rollback

Use `scripts/build-kinetic-hero.cjs` for a new edit, not for delivery compression.
Use `scripts/optimize-kinetic-delivery.cjs` for AV1 encoding and validation. Do not
commit ignored originals, editing masters, browser reviews or rejected trials.
To roll back a published code release, revert its commit on main or promote the
known-good previous Vercel deployment. Never reset shared main or overwrite CMS
publications with bundled seeds.
