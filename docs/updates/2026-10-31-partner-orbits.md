# Partner orbit refinement — 31 October 2026

Removed pause/play and full-list controls as requested. All 26 current partners remain on screen throughout desktop orbiting, instead of hiding intersecting cards. Two evenly spaced rounded orbital paths protect the central heading and keep complete cards within the viewport. Motion follows scroll with easing and a bounded catch-up speed; opacity stays at one. Keyboard focus and reduced-motion preferences remain supported.

Cards are now 128 × 92 base pixels, with 22 px corners and rounded logo surfaces. Mobile/tablet retain the responsive grid, with smaller card heights. The published partner catalogue and media assets are unchanged.

Validation: 20 targeted unit tests passed, including a full rotation across five desktop sizes and continuous movement across the orbit seam. Four Chromium/WebKit browser cases passed, covering phone/tablet layouts, all 26 visible desktop cards, no controls/intersections/clipping, and per-frame continuity. Production build and all 29 artifact checks passed.

Evidence: `output/site-polish/orbit-refinement-*`. Local preview on port 4188 serves `main.4a2389ec.js`. This update is pushed to the existing feature branch; production main is not merged by this task.
