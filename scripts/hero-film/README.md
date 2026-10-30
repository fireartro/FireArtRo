# Romanian hero film, 30 October 2026

Two 90-second silent compositions, 30 fps: 3840 × 2160 and 2160 × 3840. Each has three exactly 30-second chapters. Captions are live HTML in `frontend/src/data/heroMontageTitles.json`, driven by the active video's clock; they are deliberately absent from exported footage.

The existing Romanian live phrases and title placement are preserved. Cuts, source in-points, speed and photo framing are explicit in `edit.json`. Camera files come from the supplied Downloads folder/ZIPs. Drone photographs are existing gallery assets. Selected sources contain no printed corner logos; logo-bearing references are not used in the final edit. No synthetic fireworks or generative logo removal is used.

## Reproduce (PowerShell, repository root)

Requires Python 3 + Pillow, FFmpeg/FFprobe with NVENC, Node and HyperFrames CLI 0.8.221. This workstation uses `npx.cmd`.

```powershell
python scripts/hero-film/bootstrap.py 'C:/Users/Manu/Downloads/Folder nou'
python scripts/hero-film/prepare_edit.py
python scripts/hero-film/author_compositions.py
npx.cmd --yes hyperframes check output/hero-rebuild/landscape --json
npx.cmd --yes hyperframes check output/hero-rebuild/portrait --json
python scripts/hero-film/render_final.py
python scripts/hero-film/deliver.py
```

`FIREART_HERO_WORKDIR` can select another scratch directory. Full-resolution camera footage is conformed directly with FFmpeg to avoid an unnecessary browser/JPEG roundtrip. HyperFrames renders the deterministic photographic motion. Individual scenes are joined without a transition frame being added or dropped. Sequential scene rendering bounds memory on this 16 GB workstation; rendering all source extractions simultaneously exceeded available memory.

Outputs:

- `output/hero-rebuild/FireArt-landscape-4K.mp4` and `FireArt-portrait-4K.mp4`: 2700-frame masters.
- `frontend/public/media/hero-film-{wide,portrait}-{1,2,3}.mp4`: 1080 delivery.
- Matching `-uhd.mp4`: 4K delivery. H.264, 4:2:0, SDR BT.709, faststart, no audio or printed branding.
- Two WebP posters and `output/hero-rebuild/delivery-report.json`.

The site selects the appropriate aspect ratio and resolution and falls back to HD if UHD fails. Media covers the full hero surface. Every desktop source is panoramic 16:9; square photos, portrait inserts, black side panels and split-screen layouts are excluded. The phone uses an independent selection and framing. Photograph motion is limited to 2 percent. Wider tablets and ultrawide screens anchor the image toward the sky, keeping the drone formations inside the visible crop. The incoming chapter is immediately opaque, so the opening poster cannot flash between chapters.

Desktop daylight contains two continuous, distinct events (22 seconds + 8 seconds). The 120 fps rainbow recording is slowed to 25 percent; the 60 fps column recording uses motion interpolation for a smooth longer hold. There is no repeat of the wedding from the second camera. All stills depict drones. Night source intervals do not overlap, and the finale uses its own interval.

Source quality remains the real ceiling: original drone photos are up to 1800 pixels. A 4K export preserves the best supplied detail; it cannot create native 4K camera detail in those photographs.

Validation: `audit_edit.py` checks chapter coverage, repeated source intervals, repeated daylight events and the drone-only photo rule. `verify.py --decode` checks frame timestamps, dimensions, codecs and full decode of all 12 delivery files. Six player/caption unit suites and the real-media browser matrix live in the frontend. Render review sheets and logs remain under the scratch directory. Neither this pipeline nor the task deploys to production.

For the local production-build preview, `node scripts/hero-film/preview.cjs` serves port 4188, including byte-range media requests and the downloaded public CMS snapshot in `output/hero-rebuild/live/public-content.json`. This does not bypass or change the production content gate. Run browser checks with `PLAYWRIGHT_USE_EXISTING_SERVER=1` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4188`.
