# Hero media review — 30 October 2026

Completed locally in the FireArt checkout. Production has not been published.

## Delivered

- Two clean 90-second masters: 3840 × 2160 and 2160 × 3840, 2700 frames each.
- Three 30-second chapters per orientation, each delivered in HD and UHD: 12 MP4s, 900 frames each, H.264, SDR BT.709, no audio, faststart.
- Romanian live captions and existing page placement retained. Captions follow the active media clock; they remain HTML rather than being printed into the footage.
- All stills show drones. Fireworks-only scenes use moving footage. Desktop daylight uses two continuous events, 22 s + 8 s, as requested.
- No repeated source intervals or repeated photos within either 90-second edit. The two camera angles of the same daylight wedding are not replayed as separate events.
- Independent panoramic and portrait selections fill the hero. Tablet/ultrawide framing protects the sky formations. No split panels or black side bars are embedded in the edits.
- Selected source intervals and photographs contain no printed corner logo. Site navigation branding remains separate from the media.

## Verification

| Check | Result | Evidence under `output/hero-rebuild/` |
| --- | --- | --- |
| Editorial rules, chapter coverage, source overlap | Passed, both formats | `edit-audit.json` |
| 12 files: full decode, dimensions, frame count, every timestamp, faststart | Passed | `media-verification.json`, `media-verification-final.log` |
| Public assets and production-build assets | All 12 SHA-256 hashes match | `delivery-report.json` |
| Player, clock, delivery selection and Romanian captions | 55 tests / 6 suites passed | `unit-final.log` |
| Chromium + WebKit, 9 viewport/DPR combinations, rotation, loop, HD fallback | 22 tests passed | `browser-framing-final.log` |
| Immediate opaque chapter handoff after removing the poster flash | 2 browser tests passed | `handoff-final.log` |
| Production build | Compiled successfully | `build-final.log` |
| Composition validation | Both passed; no runtime/layout errors | `landscape-check-unique.json`, `portrait-check-final.json` |
| Visual review | Both masters, all selected photographs, 32 site captures | `review/*master-final.jpg`, `site-final/` |

The framing regression was reproduced before the CSS correction (`crop-regression-before.log`). The chapter flash was also reproduced: the next active video initially had opacity 0 (`handoff-before.log`). The final player switches directly to the decoded next frame at opacity 1.

Final local preview: `http://127.0.0.1:4188`, using the public CMS snapshot. Served bundle: `main.bc6f7678.js`, stylesheet: `main.8b1f7843.css`. This preview is distinct from the older server on port 4187.

## Source limits

Drone photographs are up to 1800 pixels; exporting them in 4K does not manufacture native 4K detail. Cropping on aspect ratios other than 16:9/9:16 prioritizes the sky while keeping the hero filled. The short desktop column recording uses motion interpolation to extend its supplied action; the original camera file ends while trails remain visible. Browser device checks use viewport/DPR emulation, not a physical-device laboratory.
