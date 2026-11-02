# Hero media review — 2 November 2026

The landscape and portrait edits now run 120 seconds each at 30 fps, delivered as three 40-second chapters. The extra time allows selected volleys to finish before a camera change. Landscape has 13 shots (six moving sequences and seven drone photographs); portrait has 16 (nine moving sequences and seven drone photographs). Both retain the exact camera and photograph ID sets from the preceding edit, with revised source in/out points. Landscape has two pairs of adjacent drone photos; neither format has three consecutive photos. Fireworks appear only as footage. All source windows and orientation overrides are recorded in `edit.json`.

Night footage was reviewed through ignition, peak and decay. All 11 night exits have at most 4.022% of their sampled peak sky brightness above the noise floor, measured before the delivery fade. The sky region is the upper 70%, except V03's upper 55% because that camera tilts toward a lit building. This measures the sky rather than promising that buildings or streetlights become black. After the reviewed natural decay, delivery adds a 0.45-second close toward black without shortening the selected source interval. Every moving-scene exit reaches black before the next shot; the incoming shot is fully visible. The 2.577-second wide daytime source contains no further recorded tail beyond the opened color columns.

The site serves Full HD, Retina (2560x1440 landscape / 1440x2560 portrait), and UHD landscape at 3200 or more physical display pixels. Portrait tops out at Retina. The 15 H.264 files contain no printed logo, audio or embedded captions. Nine Romanian HTML title cues follow the active video clock, with orientation-specific timing and three five-row accents in the site's blue (#78b8ff).

## Local acceptance

Evidence below is in `output/hero-recut-r6/` unless another location is specified. This directory contains review artifacts and masters and is excluded from deployment.

| Check | Result | Evidence |
| --- | --- | --- |
| Shot balance, source bounds, chapter coverage and repeated source intervals | Both edits passed; camera/photo ID sets preserved | `edit-audit.json`, `scripts/hero-film/edit.json` |
| Visual cut review | 321 sampled frames: nine per moving shot and six per seam, including chapter boundaries | `cut-review/{landscape,portrait}/` |
| Encoded holds in native moving footage | All 7200 master frames hashed; longest identical run is one frame | `cut-review/{landscape,portrait}/frame-holds.json` |
| Natural night-effect exits | All 11 passed the sky-decay threshold before delivery fades | `cut-review/{landscape,portrait}/frame-holds.json` |
| Full decode, 1200 timestamps per file, SDR BT.709 limited range, faststart | All 15 files passed | `media-verification.json`, `verify.log` |
| Delivery exit and incoming-frame checks | Every moving-scene exit black; following scenes visible | `media-verification.json` |
| Video payload | 546,756,178 bytes versus 632,737,735 previously: 13.59% smaller with 33.33% more running time | `media-verification.json` |
| Compression comparison | All 15 renditions passed SSIM >= 0.965 on matched three-second samples; measured range 0.973807–0.992122 | `compression-review/ssim.json`, matched-detail JPEGs |
| Chromium and WebKit | 37 distinct browser scenarios passed, including 11 viewport/density combinations in both engines | `browser-first/`, `browser-clean/`, `browser-matrix/`, `browser-mobile/`, `browser-flows/` |
| Frontend unit tests | 66 suites / 452 tests passed | `unit-all.log` |
| API and deployment contract checks | 53 tests passed | Root `npm run test:api` |
| Production build and public artifact checks | Build passed; 29 artifact checks passed | `build.log`, root `npm run test:artifacts` |
| HyperFrames 0.9.3 composition checks | Both passed with zero errors; intentional silent-film warning | `check-wide-final.json`, `check-portrait-final.json` |

Browser scenarios cover advancing playback, format/resolution selection, complete formation and caption bounds, all nine phrases, five-row accents, chapter switching, loop restart, orientation changes, decode fallback and prolonged buffering recovery. Viewports and device densities are emulated; these checks do not claim physical-device testing. Four small-phone/desktop scenarios were rerun after making the test wait for cookie-consent dismissal, giving 41 executed browser checks in total.

The frame-hash check detects exact repeated decoded frames; it does not replace the visual cut review. SSIM is a sampled compression comparison, not a lossless or full-film quality guarantee. Source drone photographs are up to 1800 pixels; UHD preserves their supplied detail without inventing native 4K detail. Live deployment and active media are verified separately after the Git push.
