# Hero media review — 1 November 2026

The wide and portrait masters run 90 seconds each at 30 fps. Each edit uses 16 shots, with nine moving sequences and seven drone photographs. Each format has its own selection and framing. The two daytime events are separated by a drone formation. No adjacent photographs or repeated source intervals occur. The six chapters are delivered in HD and UHD, giving twelve 30-second H.264 files. They have no printed logo or audio. Nine Romanian HTML title cues follow the video clock, including three five-row kinetic stacks.

## Local acceptance

| Check | Result | Evidence in `output/hero-rebuild/` |
| --- | --- | --- |
| Shot balance, chapter boundaries and source overlap | Both edits passed | `edit-audit.json` |
| Full decode, 900 timestamps, SDR BT.709 limited range, faststart | All 12 MP4s passed | `media-verification-r4.log` |
| Public and production build MP4s | 12 matching SHA-256 checksums | `delivery-hashes-r4.json` |
| Player and title behavior | 50 tests in six suites passed | `unit-r4.log` |
| Chromium and WebKit | 42 checks passed across 11 viewport and pixel-density combinations | `acceptance-r4.log` |
| Full homepage playback | All three chapters played on both recordings | `site-proof/desktop-90s.webm`, `site-proof/phone-90s.webm` |
| Production bundle and compositions | Build completed and both HyperFrames checks passed | `build-r4.log`, `check-wide-r4.json`, `check-portrait-r4.json` |

Browser checks cover foreground recovery, constrained buffering, UHD fallback preserving the playhead, rotation, chapter transitions and all five animated rows. Device checks use browser emulation. Photos retain their supplied detail, up to 1800 pixels. The 4K delivery preserves framing and timing across formats. These are local results. The production deployment is tracked separately in Vercel.
