# Hero media review — 1 November 2026

The wide and portrait masters run 90 seconds each at 30 fps. Each edit uses 16 shots, with nine moving sequences and seven drone photographs. Each format has its own selection and framing. The two daytime events are separated by a drone formation. No adjacent photographs or repeated source intervals occur. This delivery revision changes encoding and screen-size selection while keeping the approved 30-second edits, framing and timing. The site now serves 1080p HD, Retina (2560x1440 landscape or 1440x2560 portrait) and 4K landscape on screens above 3K; portrait stops at Retina. The 15 H.264 files contain no printed logo, audio, subtitles, chapters or metadata. Nine Romanian HTML title cues follow the video clock, including three five-row kinetic stacks.

## Local acceptance

| Check | Result | Evidence in `output/hero-rebuild/` |
| --- | --- | --- |
| Shot balance, chapter boundaries and source overlap | Both edits passed | `edit-audit.json` |
| Full decode, 900 timestamps, SDR BT.709 limited range, faststart | All 15 MP4s passed | `web-opt-r5/delivery` and `media-verification.json` |
| Public video payload | 632,737,735 bytes, 17.2% smaller than the previous 764,162,231-byte set while adding six Retina renditions | `web-opt-r5/delivery` |
| Representative encoding comparison | HD SSIM 0.9877, UHD SSIM 0.9936; visually reviewed contact sheets for all six edits | `web-opt-r5/review` |
| Resolution selection | Three unit tests passed | `frontend/src/components/site/heroDelivery.test.js` |
| Chromium and WebKit | 32 browser checks passed across 11 viewport and pixel-density combinations | `frontend/e2e/hero-montage-rebuild.spec.js` |
| Production build | `yarn build` completed successfully | `frontend/build` |
| Earlier edit and full-playback review | Both 90-second edits and all three chapters passed the original review | `edit-audit.json`, `site-proof/desktop-90s.webm`, `site-proof/phone-90s.webm` |

Browser checks cover foreground recovery, constrained buffering, high-resolution fallback preserving the playhead, rotation, chapter transitions and all five animated rows. Device checks use browser emulation. Photos retain their supplied detail, up to 1800 pixels. UHD encoding preserves framing and timing; the representative comparison reports SSIM rather than claiming lossless re-encoding. These are local results. The production deployment is tracked separately in Vercel.
