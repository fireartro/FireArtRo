# Homepage film — September 2026

## Current status — approved 32-second v3, production release preparation

The 20-second fireworks-only v1 and slow 10-second v2 were rejected. The current
local implementation is v3: 32 seconds, 24fps, fourteen shot hosts, alternating
original fireworks video and real drone photographs. No new drone footage is
invented. Original files are untouched. On September 9 the user approved the edit
and explicitly requested optimized production delivery. The release record is
`docs/performance-release-2026-09-09.md`; historical rejected exports below must
not be promoted.

Six independently rendered HyperFrames 0.8.31 compositions are staged under
`output/fireart-cinema/kinetic-v3`. Portraits use vertical photographs fitted
without clipping their formations, with feathered edges into a black field;
they do not duplicate the image into a blurred background. This means portrait
photos do not fill every vertical pixel. Video shots remain full-frame.

The user's latest reference is the typography in the currently hosted movie:
heavy, broad capitals; punch and lateral entrances; five-row solid/outline
stacks held on screen, with lime highlights and a red combined-show accent.
`HeroKineticTitles` renders this as a separate, responsive DOM layer synchronized
to video time. Montserrat Black is a visual match, not a verified identification
of the font baked into the original MP4. It is self-hosted, subsetted to the
uppercase/diacritic character set used by the film (16,972 bytes), with its
[SIL license](https://github.com/google/fonts/blob/main/ofl/montserrat/OFL.txt).
Only the hero film uses it; existing website typography is unchanged.

Approved copy revision, 2026-09-09: CERUL / IA FORMĂ.; successive CULOARE.,
RITM., MIȘCARE. on the 7.3s, 9.5s and 11.8s shot cuts; TOTUL, / ÎN SINCRON.;
then DRONE / × ARTIFICII. for the finale. Six title windows retain the existing
entrance styles, including the five-row stack on RITM. The site copy and
all six rendered video assets are unchanged by this text-only revision.

The shared cue sheet is `frontend/src/data/heroFilm.json`. Kinetic titles are
excluded from accessibility navigation and custom Admin media, stop with the
video, and disappear when the poster/reduced-motion mode is active. They render
outside the video crop. In an exceptionally short viewport with no safe space,
the decoration hides rather than covering the real heading and buttons.

### Local exports (H.264, yuv420p, fast-start, 768 frames, no audio)

| Profile | Resolution | MiB |
| --- | --- | ---: |
| Wide | 1920x1200 | 22.38 |
| Ultrawide | 1920x900 | 18.20 |
| Tablet landscape | 1440x1080 | 16.83 |
| Tablet portrait | 1080x1440 | 14.64 |
| Phone | 720x1280 | 9.12 |
| Tall phone | 720x1560 | 10.54 |

These H264 exports remain the compatibility fallback. A smaller AV1 delivery is
encoded directly from the same masters and selected only when the browser reports
supported, smooth, power-efficient decoding. A failed/slow capability check uses
H264, and a decoder error falls back to H264. One file loads at a time. The movie
is longer and higher-resolution than the older 20-second production asset; savings
in this release are measured against the approved v3, not the rejected old movie.
No denoising, new crops, reduced dimensions or changed frame rate are applied.

Reproduce with `node scripts/build-kinetic-hero.cjs --render`; use `--refresh`
after composition changes (the previous generated masters are retained), or
`--reencode` for encoding changes. `node scripts/promote-kinetic-hero.cjs` validates
all six exports before copying them to local public/build media. Neither script
deploys or modifies Git. Do not use the historical v1 exporter below for v3.

Delivery-only AV1 reproduction: `node scripts/optimize-kinetic-delivery.cjs --encode --promote`.
It refuses to overwrite existing encodes, verifies all six files (dimensions,
32 seconds, 768 frames, no audio, fast-start, smaller bytes), and requires full-film
VMAF >=95 against each master before copying any file to public media. The initial
tablet/phone trials below that gate were replaced with higher-quality encodes.

Local viewing page: `http://127.0.0.1:4173/cinema-review`. Its controls select
phone/tablet/desktop viewports and pause or seek the real homepage video.
The preview server proxies only public read requests; submissions are disabled.

## Historical status — first export rejected, do not publish

The user rejected the first export for poor detail and missing drone imagery and
cinematic titles. The public media edits described below are NOT approved for
deployment. A separate 10-second quality sample is being prepared under ignored
`output/fireart-cinema/sample-v2`. The user has authorized the site's drone photos
with restrained camera movement; no drone video originals are available. No new
production deployment or responsive batch export should precede sample review.

The v2 review sample is now rendered at
`output/fireart-cinema/sample-v2/fireart-cinematic-sample.mp4`: 1920x1080,
24fps, 10 seconds, 240 frames, H.264, no audio, 26,286,533 bytes. It uses the
site's gold drone-gate and Baia Mare aerial-arch photos, followed by native
landscape fireworks footage. Copy: “UNELE NOPȚI / RĂMÂN CU TINE.” Source photos
remain still photographs with a four-percent camera move, not simulated drone
footage. The encoded sample, including its final frame, was visually inspected;
blackdetect found no black intervals. Root lint and runtime checks passed. Studio
snapshot video frames can appear black despite correct offline video extraction;
the encoded MP4 is the review artifact. This large review master is not the final
web delivery. Site integration, a continuous loop and portrait framing remain
pending the user's review. No production push or deployment was made.

## First export (historical, rejected)

20-second silent loop. Four real, owner-supplied night fireworks shots, without
burned-in logos, text, generated effects or blurred padding. The site's HTML
logo, headline, buttons and approved page design are unchanged.

## Original footage / edit

| Inventory ID | Original | In point | Prepared duration | Purpose |
| --- | --- | ---: | ---: | --- |
| 05 | IMG_6487.mov | 35.1s | 6.5s | Violet fans / opening and loop seam |
| 24 | GX011315.MP4 | 79.7s | 5s | Open-sky blooms |
| 14 | IMG_7007.mov | 74.9s | 5s | Golden comet canopy |
| 32 | IMG_9074.mov | 139s | 5.5s | Wide finale |

Originals remain untouched in the owner's `Barbul/Trimise de el` folder. They
are 60fps sources, retimed to 75% and delivered at 24fps. Half-second dissolves
overlap the shots at 5.5s, 10s and 14.5s. At 19.5s the first half-second of the
opening clip dissolves in; the opening itself starts at media time 0.5s.

No clean original drone-show footage was found in the inspected source folders.
Watermarked drone edits and unrelated stock aerial footage are not included.
Add verified, owner-supplied clean drone footage before describing this movie
itself as containing drone shows.

## Reproduction

Prerequisites: frontend dependencies, Node, FFmpeg/FFprobe and HyperFrames 0.8.31.
The local source inventory is a JSON array with `index` and absolute `file` paths.
Only the four IDs above are required. Do not commit original videos or private
machine paths. Run from the repository root:

```powershell
node scripts/prepare-cinematic-hero.cjs C:/path/to/source-inventory.json
npx hyperframes@0.8.31 check output/fireart-cinema/landscape --snapshots
npx hyperframes@0.8.31 check output/fireart-cinema/portrait --snapshots
npx hyperframes@0.8.31 render output/fireart-cinema/landscape --fps 24 --quality high --crf 17 --workers 2 --output output/fireart-cinema/landscape-master.mp4
npx hyperframes@0.8.31 render output/fireart-cinema/portrait --fps 24 --quality high --crf 17 --workers 2 --output output/fireart-cinema/portrait-master.mp4
./scripts/render-responsive-hero.ps1 -LandscapeMaster ./output/fireart-cinema/landscape-master.mp4 -PortraitMaster ./output/fireart-cinema/portrait-master.mp4
```

Inspect snapshots AND the rendered movies before promoting a new edit. The web
export script stages all six files before replacing their tracked destinations,
checks duration/dimensions/codec/frame rate/byte budgets, and generates matching
WebP posters. The editable HTML projects and masters live under ignored `output/`.

## Delivery contract

- One of six H264 High Level 4.0 MP4 files per viewport; no audio track.
- Separate 1920×1080 landscape and 1080×1920 portrait masters, framed per shot.
- Web dimensions: 1536×960, 1536×720, 1152×864, 864×1152, 720×1280, 720×1560.
- Version token `20260908-cinema` changes both video and poster cache keys.
- Poster paints before video activation. Hidden tabs defer the initial video download.
- Mobile toolbar/keyboard height changes preserve the current video source;
  width/orientation changes still select a matching composition.
- Reduced motion, data saver, slow connections and unsupported H264 use a still.
- Admin-supplied media overrides remain supported; publishing content is unchanged.

The MP4 delivery cap is deliberately limited without promising better bandwidth
than every previous variant: the new footage has continuous high-detail motion.
Measure actual public requests, decoded playback and visual quality before
lowering bitrate further. A local build or a synthetic score does not prove
field performance on every phone.
