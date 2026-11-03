# Design log

A running record of design critique rounds. Every round is based on Playwright
screenshots in `docs/screenshots/` at 390×844 and 1440×900, in light and dark,
captured by `apps/web/scripts/screenshots.mjs` against a production build.

## 2026-11-03: direction

- Wrote `DESIGN_DIRECTION.md` and reviewed it against the banned list. Two items
  failed the first draft:
  - The four knowledge states were planned as four identical cards. They became
    an interactive legend strip with a segmented control.
  - There was a "North York pilot" eyebrow above the hero headline. It moved
    into the coverage sentence under the search.
- **Contrast.** `check-contrast.mjs` caught a real bug on its first run: the
  high-contrast route casing was the same colour as the route lines, at 1.0:1.
  - Fix: the casing now uses the surface colour.
  - Result: 156 pairs pass across light, dark, light-more and dark-more.

## Round 1: landing and planner (`r1-*`)

**Bug found by looking.**
- The planner map was blank even though MapLibre reported 57 route features
  drawn.
- Cause: MapLibre's stylesheet sets `position: relative` on the map container.
  That overrode my `absolute inset-0`, so the container collapsed to zero
  height.
- Fix: the container is sized with `width/height: 100%` inside a positioned
  wrapper (`.pa-map-container`).
- The tool's own screenshots cannot capture WebGL. The screenshot script uses
  full Chromium with SwiftShader so the map appears in review images.

**Critique.**
1. Planner, 1440: "Edit preferences" and "Copy link to this trip" wrap onto two
   rows and push the routes below the fold. Labels shortened to "Preferences"
   and "Copy link".
2. Route stats in monospace at 18 px read like a typewriter and compete with the
   route name. Dropped to 16 px. Tabular mono stays, because the figures must
   line up between cards.
3. In dark mode, the MapLibre attribution control is a white pill. It is now
   restyled to `--surface-raised` and `--ink`.
4. Landing, 390: the live map sits below the fold. That is acceptable: the
   headline and a working search are the first viewport, which the wireframe
   intended.
5. **Removed one decoration per screen:**
   - Landing: the shield icon above the AI note. The sentence carries itself.
   - Planner: the warning and speech-bubble icons beside the barrier and report
     counts. A count in barrier red, in bold, says more.
