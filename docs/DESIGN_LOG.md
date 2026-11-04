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

## Round 2: the whole landing page, held to the best product sites (`r2-*`)

**References.** I studied these for principles, not looks:
- Apple Maps: panels layer over the map, and the map does the talking.
- Linear: the real interface is the hero, rendered with precision.
- Stripe: numbers and specimens carry the argument.
- Transit: route lines that read at a glance.

The common thread: every section shows the actual product or the actual data,
and nothing is decoration.

**Critique of r1 below the fold.** The hero worked; everything after it failed
the "would this look the same on a generic SaaS page?" test.
1. Five text-only sections in alternating background bands (grey, white, grey,
   blue, grey), with big empty gutters. Nothing showed PathAble.
2. The knowledge-states legend was four tiny swatches in a grey box and a lone
   "78.0%".
3. The yellow fixture banner was the loudest thing in the hero and competed
   with the single emerald action.
4. Details showed step distances like "70.2 m". The ICU `::0` skeleton was not
   applied; walking distances to a tenth of a metre are false precision.
5. Headings that receive focus programmatically on step changes drew a visible
   halo box.

**Changes.**

| Section | Before | After |
| --- | --- | --- |
| How it works | Four text columns | A numbered list beside a real route card for York University to Finch West, rendered by the same component as the planner and marked `inert` |
| Knowledge states | Swatch legend | A specimen table: line sample, icon and name, meaning, and the measured corridor share with a bar. Choosing a row isolates that state on the real corridor route. |
| Reporting | Text block | A spec sheet of exactly which EXIF fields are removed on the device, what is sent, and the analysis status ("Off. No model has passed evaluation.") |
| Winter | A blue band | A single example of a winter report card with its expiry, captioned plainly as an example, not a real report |
| Trust | Text | The corridor's state distribution as one full-width bar with the numbers, and a table of every source with its publisher, refresh date and licence, read from `reality_check.json` |
| Fixture banner | A full-width yellow bar | A compact overlay inside the map frame. Still collapsible, never dismissible. |

**Also fixed:**
- Walking distances round to 5 m below a kilometre.
- Programmatically focused headings no longer draw a ring.
- The bands are gone. Sections are separated by a hairline and 96 px of space.

**Removed one decoration per screen:** the snowflake beside the winter heading,
which now appears only on the example card, where it carries meaning.

**Still open:**
- On the states map, the corridor is long and thin, so the isolated state reads
  small at 1440. A tighter crop would help.
- At 390 the hero map sits below the first viewport by design.

## 2026-11-03: Guidance that follows you, transit beside walking, less text

**Feedback.** "Click Start and it should tell me how and where to go, and if I
should take the bus." The planner felt static and wordy.

**Changes.**

| Area | Before | After |
| --- | --- | --- |
| Guidance | A full-screen dialog of text steps with Previous and Next | The map stays. One instruction banner on top, time and distance left in a bar below. The camera tilts and follows the position; instructions advance on their own and change with a short slide. Off the route on foot, it plans again. Without location, the same screen is a labelled preview that walks the route. |
| Transit | None | A Walk / Transit switch with the best time on each side. Transit cards are a row of leg chips (walk 4, Line 1, walk 2) in the line's own colour, the departure, and one step-free chip. The ride is drawn along the vehicle's real path. |
| Route card | Seven lines: label, badge, distance and time, compatibility sentence, barriers, reports, freshness, why, details | Time large, distance small, one status chip, the knowledge bar, and Details and Start. Reports, freshness and "Why this route?" moved to Details. |
| Landing | Long step descriptions and an extra paragraph on analysis | One line per step with an icon; the hero lede shortened |
| Motion | One load moment per page | The landing opens with the mark drawing itself once per session (ring, P, dot, about one second, never under reduced motion, headline painted beneath it). Hero items rise in turn; later sections rise as they scroll in; cards enter with a short stagger; buttons lift on hover and press on click; pages after the first fade in. |

**Rule kept:** body text and numbers still never animate on their own; motion
follows something the person did or a change of state.

**Still open:**
- Real-device test of following and voice on a phone outdoors.
- Transfers between two vehicles.

## 2026-11-03: a picture instead of a map, a profile for blind travellers, a map that follows you

**Feedback.** The map in the landing hero looked odd; the planner map should
move with the person; there should be a choice for blind travellers.

| Area | Before | After |
| --- | --- | --- |
| Landing hero | A live MapLibre map of three corridor routes with a ranking control | A phone showing guidance on the real York University to Finch West route: the dot walks the line and the instruction changes at each real step. Captioned as an illustration. The landing no longer loads the 1 MB map library. |
| Profiles | Seven mobility aids, all about wheels and walking | Adds **Blind or low vision**: crossings at signals need a recorded accessible pedestrian signal, curb ramps are wanted, and voice guidance turns on. Picked from the landing, the planner or Settings. |
| Signal data | Only "has an accessible signal" was kept; a blank City record looked the same as no signal | Three cases: recorded (verified), blank (no data), no signal (not judged). A blank record is never called a barrier. |
| Planner map | Fits the route | A **my location** button: the map follows you, dragging lets you look around, pressing again stops. |

## 2026-11-03: the landing walks the route as you scroll

**Feedback.** The phone animation in the hero was not good; make it cleaner
and driven by scrolling.

| Area | Before | After |
| --- | --- | --- |
| Hero | Headline beside a floating phone that looped a walk on its own, with a glow and a drifting chip | One calm column: headline, search, Find your route, and the four "How do you get around?" choices. Nothing moves after the entrance. |
| Walk-through | None (the loop played whether you looked or not) | A section below the hero where the phone holds still and the route advances with the page. Five chapters stop at real steps: a crossing with recorded curb ramps, one where the City's signal record is blank, one with an accessible signal, the turn where Line 1 would save 19 minutes (computed from the transit fixture, not typed in), and the arrival. On a phone the current chapter's text sits under the picture; on a wide screen the chapters scroll past on the left. |
| Planner map | The dot could fail to appear if your position arrived before the map had started | The dot and follow camera wait for the map and then catch up. |

**Rule kept:** nothing plays on its own. Scrolling is the only thing that moves
the walk-through, and with reduced motion it jumps from step to step.
