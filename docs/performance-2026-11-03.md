# Smaller media delivery, 3 November 2026

The mobile hero previously selected a 38.29 MiB Retina film on a measured
1.5 Mbps connection. Gallery cards also requested full-size photographs.
The design, image crops, ordering, source films, duration and frame rate are
preserved; delivery now accounts for bandwidth as well as device pixels.

## Video

`frontend/src/data/heroDelivery.json` is the shared source of film URLs for
the player and early-startup regression tests. Each chapter has:

- A smaller H.264 HD encode at the original HD dimensions, CRF 29.
- A 720p H.264 rendition at approximately 1.2 Mbps for weak connections.
  Portrait chapter 2 uses approximately 1.4 Mbps to retain face/colored-trail
  detail. Every chapter retains its complete original duration and 30 fps.
- The existing Retina/UHD files for higher-density displays on faster
  connections. The old HD originals remain available as well.

Measured downlink up to 2.5 Mbps, or effective 2G/3G, selects light delivery.
Measured downlink below 8 Mbps selects HD. Phones that cannot report
bandwidth use HD in either orientation. Explicit data-saving/reduced-motion
preferences continue to control autoplay. Prolonged buffering steps down
to light while preserving the chapter/time; errors on a light film retry
that film without upgrading bandwidth. Height-only mobile browser changes
continue to preserve the current element.

The early script uses the same quality rules and accepts the exact new
versioned static paths. New files use date-versioned Romanian names and
immutable cache headers. The startup reveal uses the same shorter,
recompressed 2.3-second H.264 film.

Rebuild manually with Python and the local FFmpeg skill package:

```powershell
python scripts/build-light-hero.py --skill-dir C:/Users/Manu/.codex/skills/ffmpeg-skill
```

Outputs and quality reports are staged separately from originals. When
changing source footage, use a new media version and rebuild its generated
renditions. Do not reuse an immutable public URL for different bytes.

## Photographs

`scripts/build-responsive-images.py` generates high-quality AVIF (65) and
WebP (86) derivatives for 224 opaque bundled photographs. It keeps the
originals byte-identical, records source hashes/dimensions, and only lists
derivatives that are smaller than their original. Browser selection uses
640/1280/full-size candidates as available, including AVIF hero covers.

The manifest is an exact allowlist. Only historical crop URLs explicitly
present in the committed catalogue are aliases. Other query versions,
uploads and external sources remain untouched. `ResponsiveImage` preserves
image classes, crop styles, dimensions, events and alt text; the picture
has no layout box. Package CSS targets the descendant image class so its
absolute cover positioning continues to work.

Gallery thumbnails use derivatives; the lightbox continues to use the
original photo. Only the first two cards load eagerly. All image names,
descriptions and old redirects from the Romanian SEO migration remain.

Homepage callers with an explicit source set retain their existing reviewed
responsive presets, including the dedicated portrait crops for package
cards. `responsivePresetImages.json` maps those exact WebP files to AVIF
at identical dimensions. Raw-source gallery/page media uses the original
composition in both formats; it does not opt into homepage-specific crops.

```powershell
python scripts/build-responsive-images.py
```

Hero cover preloads, the intro picture and the runtime picture select the
same AVIF files. WebP remains available for browsers without AVIF support.

## Verification

531 frontend tests, 81 API tests and 49 artifact checks passed locally,
including early selection against the real source map, long buffering,
light-source errors, original-photo integrity, custom URL preservation and
derivative presence/size. The production build passed. A read-only review
found and verified fixes for package selectors, startup path validation
and error escalation.

Chrome checks used the fresh SSR preview on port 4212: mobile at 390×844,
DPR 3 and 1.6 Mbps, film playback/chapter transition, 135-photo drone
filter, original lightbox, package cover positioning and WebP fallback
with AVIF decoding disabled. Temporary emulation was cleared.

The detailed before/after sizes, SSIM/PSNR comparisons, screenshots and
production checks are in the local ignored `output/performance-2026-11-03`
directory. HD comparisons use the original HD frames; light comparisons
use the same frames scaled to 720p, so their SSIM is not a claim that
720p and Retina have identical resolution. The slow variant is slightly
softer, while regular HD retains its original dimensions.
