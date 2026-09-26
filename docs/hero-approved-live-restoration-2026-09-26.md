# Restoring the owner's selected live hero moments

Scope: restore only the moments pictured in the seven supplied reference images,
not the entire old live movie. Preserve the existing page design, kinetic titles,
authentic drone photography and sequential two-slot player. Do not publish.

## Original-source mapping

The owner described approximately five or six parts, and attached seven reference
images. Each distinct pictured moment is kept exactly once in each orientation.
Times refer to the original recording, not the old 32-second rendered movie.

| Reference | Original inventory | Source | Start | Duration |
| --- | --- | --- | --- | --- |
| Gold-filled sky / ARTIFICII SI DRONE | 29 | IMG_1812.mov | 132.3 | 4 |
| Multicolor sky / CERUL IA FORMA | 32 | IMG_9074.mov | 139 | 2.75 |
| Pink-and-gold fan above trees | 01 | GX011243.mp4 | 33 | 2.25 |
| Colored jets above the yellow building | 27 | IMG_0211.mov | 5.1 | 2.25 |
| Red canopy with gold tails | 01 | GX011243.mp4 | 58.3 | 2.5 |
| White spherical bursts in the open sky | 28 | IMG_0281.mov | 3 | 2 |
| Pink-and-gold sky / TOTUL IN SINCRON | 28 | IMG_0281.mov | 190.5 | 2.25 |

Use the original 4K files through the local inventory at
`output/hero-cinema-audit/sources.json`, or pass `--live-inventory` explicitly.
The intermediate kinetic-v6/v7 assets are not a reliable source of truth:
cached assets can disagree with their edit metadata. The fan and red canopy
were visually identified in the original GX011243 footage.

## Implementation and verification plan

- [x] Compare the supplied references to available footage and record exact cuts.
- [x] Add a regression requiring these cuts exactly once in both orientations;
  observe failure before restoring them.
- [x] Extend original-source resolution with filename validation and append only
  the five needed native 16:9 recordings to the montage manifest.
- [x] Rebalance all six episodes to exactly 30 seconds, preserve requested new
  source intervals, and retain all nonduplicate Folder nou originals on mobile.
- [x] Invalidate scene caches and the browser media revision.
- [x] Render and inspect all six films, including each restored cut on mobile.
- [x] Run the complete React suite and script tests, then build the preview.
- [x] Check public/build hashes, dimensions, duration, fullscreen layout and the
  1 -> 2 -> 3 -> 1 playback/preload behavior in a real browser.

Verified: 267 React tests in 51 suites and 3 script tests pass. Production build
compiles successfully. All six films are H264 High Level 4, 24fps, 720 frames and
30.000 seconds; wide is 1920x1080, portrait 1080x1920. All eight film/poster files
have matching public/build hashes. Preview byte-range request returns HTTP 206.
Real Chrome checks passed at 1578x872, 390x844, 768x1024 and 844x390, with no
horizontal overflow and one visible/playing video. Both formats preload the
next episode at 25 seconds and complete the 0 -> 1 -> 2 -> 0 cycle. Landscape
hero height differs by less than 0.5px because of CSS pixel rounding.
Screenshots: frontend/output/playwright/hero-desktop-restored-r6.png and
frontend/output/playwright/hero-phone-restored-r6.png. Local preview only:
http://127.0.0.1:4191/#acasa, media revision 20260926-r6.

No changes to originals, no stock/AI visuals, no portrait panels on desktop,
no repeated source ranges. The correction was first delivered locally; the
owner subsequently authorized production publication on September 26 with
"da i push pe live". Production publication uses the existing main-branch
Vercel integration, without changing CMS data, secrets or project settings.
