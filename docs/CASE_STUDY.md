# Case study: PathAble, North York pilot

## Problem

If you use a wheelchair, a walker or a cane, a walking app's "fastest route" can
end at a curb with no ramp. Most map products show a route as if every sidewalk
were known and usable. I wanted a planner that compares routes by **what is
actually known about the sidewalk**, and that says plainly when nothing is
known.

## Constraints

- **No fabrication.** No invented routes, numbers, partners or AI output.
  Development data is labelled wherever it appears.
- **Four knowledge states that never blur:** verified, barrier, reported and no
  data. "No data" is never scored as accessible.
- **Accessibility of the product itself is the bar,** not a feature.
- **A real place:** North York, with a demo corridor from York University to
  Yonge and Sheppard.

## Data reality

I measured the data before writing any backend code
([DATA_REPORT.md](DATA_REPORT.md)).

**What exists:**
- OpenStreetMap represents 88.8% of the City's sidewalk inventory by length.
- Only 48% of sidewalk length has a surface tag.
- Only 7.3% of crossings have curb ramps mapped at both ends.
- Width can be estimated from City sidewalk outlines. The validation is weak,
  and the report says so.
- Running slope comes from two lidar surveys, flown in 2015 and 2023. They put
  a stretch on the same side of 5% for 95% of corridor edges, so I count slope
  only where they agree.

**What it means:** for a 5% slope limit and a 1.5 m minimum width, about 10% of
the corridor is known accessible, 12% is a known barrier, and **78% is no
data**. That number shaped the product: "no data" had to be a calm, explained
state rather than something to hide.

**The surprise:** minimum width moves the picture more than any other
preference. At 1.2 m, the known-accessible share is 25%; at 1.5 m, it is 10%.
That is why every edge carries evidence per attribute, and the state is
computed per person, at request time.

## Design decisions

- **Map as the hero, with one bold element per screen.** Signal emerald is
  reserved for the selected route and the single key action.
- **Knowledge states are encoded three ways:**
  - verified: solid line;
  - barrier: solid line with a light centre stripe;
  - reported: dashed line;
  - no data: dotted line;
  - plus an icon and a label.

  Colour is never the only signal.
- **Design review rounds with real screenshots** ([DESIGN_LOG.md](DESIGN_LOG.md)).
  Round 2 rebuilt every landing section to show the real product: a real route
  card, a state specimen table tied to the corridor map, and the measured
  numbers with their sources. Before and after are in `docs/screenshots/r1-*`
  and `r2-*`.

## Engineering decisions

- **The contract is the spine.**
  - Zod schemas generate OpenAPI 3.1.
  - The web app rejects any response that doesn't parse.
  - The API's tests validate every response against the generated schemas.
- **The rules are written twice and proven equal.** Ranking lives in Python and
  TypeScript, and both are asserted against shared cases. The web suite also
  re-ranks the real route fixtures segment by segment.
- **One router.** The development fixtures are produced by the API's own
  router, and a test checks that live and frozen rankings agree.
- **Decision records:**
  - [data sources and knowledge rules](decisions/0001-pilot-data-sources.md);
  - [interim routing engine](decisions/0002-routing-engine.md);
  - [local object storage](decisions/0003-local-object-storage.md).

## What the tests caught

These are real bugs, and each one is fixed:
- MapLibre's own CSS collapsed the map container to zero height.
- A language button whose accessible name didn't contain its visible text
  (WCAG 2.5.3).
- A language switch that dropped the selected route, because the trip seeded
  before the session store rehydrated.
- `new Date()` frozen into the report form at build time.
- A router that mutated shared graph weights on every request, so concurrent
  requests with different preferences could corrupt each other.
  The k6 benchmark exposed it.

## Results

All measured on 2026-11-03:

| Check | Result |
| --- | --- |
| axe-core violations | 0, across 13 pages × 2 languages × 4 themes plus open states |
| End-to-end tests | 144 passing |
| Web unit tests | 50 |
| API integration tests | 22, on PostGIS |
| Pipeline tests | 25 |
| `/v1/routes` latency | p95 121 ms, p99 137 ms on 50 corridor trips (6 workers) |
| `/v1/hazards` latency | p95 4.6 ms |
| Colour contrast | 156 token pairs pass WCAG AA, and AAA in high contrast |
| Routing engines, 50 trips | Known-barrier share of route length: evidence router 3.9%, Valhalla 14.5%, OpenTripPlanner 13.6% |

## What I'd do next

- **Re-run the engine benchmark on all of North York,** and give OpenTripPlanner
  and Valhalla the lidar terrain model.
- **Shrink the in-memory graph** (compact arrays, contracted chains) so all of
  North York fits a small instance. It is built and fast (p95 273 ms), but it
  takes about 596 MB per worker.
- **Deploy the live demo,** and run Lighthouse and a field test on a mid-range
  Android phone.
- **Field-check the 10 slope sites.** Then run the five-participant user study.
- **Build the photo pipeline,** with server-side EXIF stripping and blurring of
  faces and plates.
