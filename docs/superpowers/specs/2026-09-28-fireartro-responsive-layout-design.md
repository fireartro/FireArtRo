# FireArtRo responsive layout design

## Intent and scope

Keep the current Night Runway visual identity, page order, copy, CMS data, and media selection. Make **every visible part of the public site and Admin** balanced and legible at a 2560 CSS-pixel viewport, while also supporting 3840-wide displays, Full HD, tablet, phone, portrait, and short landscape. This is a layout and presentation change, not a redesign of the brand or an Admin authentication change.

The source baseline is `fireartro/main` at `d559f18`. The supplied DevTools captures use a 2560 CSS-pixel viewport inside a smaller preview; the preview's "Fit to window" scale is not the site's CSS scale. Nevertheless, measured live widths confirm a genuine imbalance: the hero content is 1920 px wide at 2560 px, the shared shell and navbar are 1440 px, and the homepage package selector is only 1120 px. Correct the real layout without applying a page-wide transform or browser zoom.

## Layout system

- Introduce a coordinated wide-screen tier for visual content and navigation, beginning after the current desktop composition has enough space. Its widths grow fluidly and stop at a deliberate cap; they do not grow to the full 3840 px just because the display is large.
- Keep reading columns constrained independently (FAQ, legal prose, blog articles, form descriptions), so lines remain readable. Visual grids, media, package selection, gallery scenes, partner bands, and footer are allowed more width than prose.
- Adjust typography by role: navigation, eyebrow labels, body copy, card titles, section titles, hero headlines, metadata, form labels, and button labels. Do not increase all `rem` values by changing the root font size. Avoid small text and undersized controls on phones as well as wide screens.
- Account for viewport **height** and aspect ratio as well as width. Short landscape must not produce a headline larger than the available scene or place all useful content below stacked navigation/filter controls.
- Make high-DPR/Retina raster images sharp where appropriate source pixels exist. CSS layout depends on CSS viewport size, not physical pixel count or refresh rate. The current hero montage's wide files are 1920×1080; a layout change cannot create true 4K detail from them. Do not silently add large video assets or double-load desktop and portrait media.

## Page and component work

- **Shared chrome:** Coordinate navbar, logo, link groups, social controls, section gutters, content shell, buttons, focus states, and footer across all public routes. Ensure the navbar does not stay clustered as the shell widens.
- **Home:** Keep the full-bleed cinematic hero but tune copy scale/position, safe areas and media framing per orientation. Expand the package selector, gallery panels, About composition, two partner bands and footer for 2560–3840 CSS px. The partner loop must not leave an empty seam on wide displays or with fewer Admin-supplied partners. Preserve the opposite scrolling directions and reduced-motion fallback.
- **Packages and Gallery:** Scale visual grids and cards without making category navigation consume the whole first screen on small/short landscape devices. Keep package selection, video controls, gallery filters, lightbox, and deep links functional.
- **Blog, FAQ and Legal:** Scale page framing, headings and controls, but retain readable article/legal line lengths. Break long CMS titles rather than clipping them.
- **Contact:** Scale the form and informational columns; switch to one field per row before native date/select inputs become cramped. Preserve validation, accessibility and the existing submission flow.
- **Admin:** Fix the conflicting 901–1050 px sidebar rules and make its own compact typography/controls usable at 2560 and smaller viewports. Its internal phone/tablet preview is only a narrow wrapper, not a real viewport emulator; use real browser viewport tests for acceptance. Do not touch Admin credentials or publication APIs in this responsive task.

## Behaviour and verification

- Verify every public route (`/`, `/pachete`, `/galerie`, `/intrebari-frecvente`, `/contact`, `/blog`, an article, `/confidentialitate`, `/termeni-si-conditii`, `/cookies`) and `/admin` at **2560×1440 CSS px**. No section is exempt merely because it was not in the screenshots.
- Also test representative 320×568, 375×667, 390×844, 667×375, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080, 2560×1700 and 3840×2160 CSS viewports. Include 200% browser zoom and DPR 2 checks where the tooling permits; inspect both portrait and landscape after orientation change.
- At each size, check document and component horizontal overflow, clipped text/media, readable computed sizes, usable hit targets and focus outlines, header/footer balance, and nonempty visible scenes. Test the key interactions: navigation, package-to-contact prefill, gallery filter/lightbox, FAQ accordion, Blog navigation, Contact validation, and Admin drawer/editing where authentication allows.
- Keep animations compositor-friendly and respect `prefers-reduced-motion`; do not implement refresh-rate-specific layout. Check motion at ordinary and high-refresh displays when available, without claiming a fixed frame rate on hardware not tested.
- Add targeted automated regression checks for the layout decisions that can be asserted reliably, run existing frontend tests and production build, then visually inspect representative live-sized browser viewports. Document any unavoidable source-media or third-party-widget limitations.

## Boundaries

Do not replace the existing logo, imagery, partner identities, copy, CMS content or legal data. Do not solve wide-screen imbalance with a global CSS scale/zoom. Do not enlarge prose to an unreadable line length or force 4K video downloads on smaller devices. Preserve the existing untracked partner images in the separate production checkout. Deployment and Vercel credential rotation are separate decisions; this design does not authorize modifying production secrets.
