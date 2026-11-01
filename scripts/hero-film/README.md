# Romanian hero film, 1 November 2026

Two 90-second silent compositions, 30 fps: 3840 × 2160 and 2160 × 3840. Each has three exactly 30-second chapters. Captions are live HTML in `frontend/src/data/heroMontageTitles.json`, driven by the active video's clock; they are deliberately absent from exported footage.

Title placement is preserved. Nine Romanian phrases follow the selected action, with one five-row stack per chapter and quiet intervals between captions. Cuts, source in-points, speed and photo framing are explicit in `edit.json`. Camera files come from the supplied Downloads folder/ZIPs. Drone photographs are existing gallery assets. Selected sources contain no printed corner logos. No synthetic fireworks or generative logo removal is used.

## Reproduce (PowerShell, repository root)

Requires Python 3 + Pillow, FFmpeg/FFprobe with NVENC, Node and HyperFrames CLI 0.8.226. This workstation uses `npx.cmd`.

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
- `frontend/public/media/hero-film-{wide,portrait}-{1,2,3}.mp4`: compact Full HD delivery (H.264 CRF 24).
- Matching `-retina.mp4`: 2560x1440 landscape or 1440x2560 portrait (H.264 CRF 21), sized for QHD screens, Retina laptops and high-density phones.
- Landscape `-uhd.mp4`: 4K delivery for large 4K landscape displays. Portrait uses its Retina rendition because no portrait hero needs more than 1440x2560 output.
- All deliveries are H.264, 4:2:0, SDR BT.709 limited range, faststart, with one video stream and no audio, subtitles, chapters, metadata or printed branding. Camera range conversion happens before footage and photos are assembled, avoiding mixed full/limited-range interpretation.
- Two WebP posters and `output/hero-rebuild/delivery-report.json`.

The site selects the appropriate aspect ratio and resolution: HD below 2K physical pixels, Retina through 3K, and 4K for denser landscape screens. Portrait layouts top out at the Retina rendition. Non-HD playback falls back to HD on a decode failure or sustained buffering, preserving the current chapter and playhead. A frame awaiting network data is not mistaken for a frozen decoder. Media covers the full hero surface. Every desktop camera recording is native 16:9. Photographs are chosen separately per orientation; nonmatching photo aspects have reviewed crops that preserve the formation. There are no black side panels or split-screen layouts. Photograph motion is limited to 2 percent. Captions move beside the heading on short landscape phones. Wider tablets and ultrawide screens anchor the image toward the sky. The incoming chapter is immediately opaque, so the opening poster cannot flash between chapters.

Each orientation contains 16 shots: nine moving-firework sequences and seven drone photographs. No photographs are consecutive. The daylight chapter interleaves two distinct daytime events with drone formations and a contrasting night sequence. Its native wide daytime footage lasts 11 seconds and 5 seconds at 50 percent speed, using real camera frames without optical interpolation. The wedding is not replayed from its second camera. Night source intervals do not overlap, and the finale uses its own interval. Each chapter ends on moving footage; the last three seconds of the finale have no animated captions.

Source quality remains the real ceiling: original drone photos are up to 1800 pixels. A 4K export preserves the best supplied detail; it cannot create native 4K camera detail in those photographs.

Validation: `audit_edit.py` checks chapter coverage, repeated source intervals, repeated daylight events, consecutive photographs and the drone-only photo rule. `verify.py --decode` checks frame timestamps, dimensions, codecs and full decode of all 15 delivery files. Player/caption unit suites and the real-media browser matrix live in the frontend. The browser matrix checks the bounds of all five animated rows. Render review sheets and logs remain under the scratch directory. These scripts prepare media; publication follows the repository's Git deployment workflow.

For the local production-build preview, `node scripts/hero-film/preview.cjs` serves port 4188, including byte-range media requests and the downloaded public CMS snapshot in `output/hero-rebuild/live/public-content.json`. This does not bypass or change the production content gate. Run browser checks with `PLAYWRIGHT_USE_EXISTING_SERVER=1` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4188`.

The generic FFmpeg-skill checker warns about absent audio and embedded subtitles. Both are intentional for this muted website background: captions remain live HTML. HyperFrames has the corresponding intentional silent-film warning.
