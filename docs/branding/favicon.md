# FireArtRo favicon

A compact firework emblem inspired by the existing FireArtRo wordmark, using the site's obsidian, white, ice blue, and electric blue palette.

## Files

- `fireart-favicon-source.png`: original generated artwork, 1254 x 1254 pixels.
- `../../frontend/public/favicon.ico`: browser icon with 16, 32, and 48 pixel frames.
- `../../frontend/public/favicon-96x96.png`: 96 pixel PNG browser icon.
- `../../frontend/public/apple-touch-icon.png`: 180 pixel Apple home-screen icon.

The public HTML document references all three browser assets. The original header logo remains the source of the brand identity.

## Creation

Generated with the built-in `imagegen` tool on 2026-09-06, using `frontend/public/media/fireart-logo.webp` as a visual reference. Public icons are bicubic downscaled exports of the original artwork; the ICO contains PNG-compressed frames. No runtime dependency is added.

## Original generation prompt

```text
Use case: logo-brand.
Asset type: a single final production favicon for FireArtRo, a premium Romanian fireworks and drone show brand.
Input image 1 is REFERENCE ONLY: existing FireArtRo white wordmark with an exploding firework above it. Create a new standalone square brand symbol inspired by that firework; do not reproduce the wordmark or its poor raster quality.
Primary request: an exceptionally elegant, immediately recognizable firework emblem, meticulously optically balanced and bold enough to be readable at 16x16 pixels. The emblem is an upward-opening radial firework burst formed from seven broad, clean, tapered geometric rays around a very small central dark gap; the longest ray rises vertically, the other rays fan outward symmetrically like a spectacular firework crown. The two lower outer rays angle down subtly so the composition feels rounded and compact, not like a wifi icon. White central rays transition into icy blue and electric blue outer rays. Each ray is a single substantial filled shape. Exquisitely clean precise vector-like edges, subtle elegant taper, memorable silhouette. Simple and visually powerful. No letters, no words.
Composition: one icon only, front-facing, perfectly square 1024x1024. A nearly black obsidian #03050a background fills the entire image edge to edge. The emblem fills about 80 percent of image width and height with only 10 percent breathing room. Center optically. Keep all key geometry broad and open enough for favicon scaling.
Palette: bright white #f5f7fb, ice blue #8dd3ff and electric blue #1677ff against the dark obsidian background. No other colors.
Avoid: text, mockup, presentation sheet, multiple variations, border, device, extra surrounding canvas, photographic fireworks, thin lines, tiny detached dots, gradients in the background, glossy app icon effects, 3D, reflections, lens flare, smoke, glitter, glow or blur, watermark. Deliver the actual finished flat icon artwork alone.
```
