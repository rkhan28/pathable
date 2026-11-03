# Performance

All numbers are measured, with the command that produced them. None are
projected.

## API latency (k6)

**Setup.**
- Script: `infra/k6/routes.js`.
- Trips: 50 fixed trips in `infra/k6/trips.json`. Each joins two points of the
  connected corridor network, 0.4–4 km apart in a straight line (median
  1,263 m). They were picked with a fixed seed by
  `services/api/scripts/bench_trips.py`.
- Graph: the demo corridor, 6,067 edges with per-attribute evidence, loaded into
  PostGIS 16 with PostGIS 3.5.
- Load: 4 virtual users requesting routes and 2 requesting hazards, constantly,
  for 60 s.
- Machine: a 10-core Apple Silicon laptop. The API ran under uvicorn on the
  host, with PostGIS and Redis in Colima.
- Run date: 2026-11-03.

| Run | Workers | `/v1/routes` p95 | `/v1/routes` p99 | `/v1/hazards` p95 | Success | Throughput |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 164 ms | 207 ms | **153 ms (fails < 100 ms)** | 94.7% | 63 req/s |
| 2 | 2 | 171 ms | 218 ms | **153 ms (fails)** | 100% | 66 req/s |
| 3 | 6 | **121 ms** | **137 ms** | **4.6 ms** | 100% | 567 req/s |

Targets: `/v1/routes` p95 < 300 ms and p99 < 800 ms; `/v1/hazards` p95 < 100 ms.
Run 3 meets all three.

**What changed between runs.**
- **Run 1 to run 2.**
  - Two problems surfaced:
    - 5.3% of requests failed. Two trips sat in disconnected islands of the
      network and two fell just outside the coverage polygon.
    - The benchmark exposed a real bug. The router wrote preference-specific
      weights into the shared graph on every request, so concurrent requests
      with different preferences could corrupt each other.
  - Fixes:
    - Weights are now computed per preference set, cached (LRU of 64 sets) and
      never mutated. `test_concurrent_preferences_do_not_interfere` proves it.
    - Coverage includes a 30 m margin around the graph.
    - Trips are drawn from the largest connected component; `no_route` has its
      own tests.
- **Run 2 to run 3.**
  - A single hazards query takes about 2 ms. The miss came from contention:
    route computation is CPU-bound Python, and hazard requests queued behind it
    in the same two processes.
  - With more workers than concurrent route requests, hazards drop to 4.6 ms
    p95, and routes improve too.
  - The API image now defaults to `WEB_CONCURRENCY=4`, set per deployment.

### With the full North York graph

- **Graph:** 105,069 edges and 1,396 measured hazards.
- **Build:** 10 minutes, 1.33 GB peak, reading lidar in 2 km tiles.
- **Load:** about 4 s when an API worker starts, and about 596 MB of resident
  memory per worker.
- **Setup:** 6 workers, same k6 profile as above.
- **Router:** A* with a straight-line heuristic, grid snapping and precomputed
  components (see ADR 0002).

| Trips | `/v1/routes` p95 | `/v1/routes` p99 | `/v1/hazards` p95 | Success | Throughput |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 corridor trips (`trips.json`) | 225 ms | 247 ms | 4.7 ms | 100% | 553 req/s |
| 50 trips across North York (`trips-north-york.json`, median 2.7 km straight line) | 273 ms | 345 ms | 6.2 ms | 100% | 465 req/s |

All targets pass, but the North York p95 is within 30 ms of the 300 ms target.
The same corridor trips take about twice as long on the full graph as on the
corridor-only graph (121 ms). The next step, if needed, is a compact array
graph (CSR) with SciPy's Dijkstra, or contracting chains of degree-2 nodes.
Either would also cut memory.

**Not yet measured:** latency on a deployed host. There is no deployment yet.

The Rust (PyO3) hot path from the spec remains a stretch goal only. On this data
Python meets the targets, so moving to Rust is not justified yet.

## Web: Lighthouse 12

**Setup.** Landing page `/en-CA`, production build, local server, default
Lighthouse throttling for mobile (simulated slow 4G, 4× CPU) and the desktop
preset. Reports are in `docs/lighthouse/`. Run with `npm run lighthouse`.

| Run | Form factor | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | mobile | **59** | 100 | 100 | 100 | 3.7 s | 3,575 ms | 0 |
| 1 | desktop | 100 | 100 | 100 | 100 | 0.77 s | 40 ms | 0 |
| 3 | mobile | **88** | 100 | 100 | 100 | 3.7 s | 144 ms | 0 |
| 3 | desktop | 100 | 100 | 100 | 100 | 0.75 s | 0 ms | 0.000008 |

Targets: mobile Performance ≥ 85, desktop ≥ 95, Accessibility 100, CLS 0.

**What changed between runs.**
- **Run 1 to run 2.** MapLibre (1.1 MB of JavaScript) was evaluated on page
  load on mobile, even though the hero map sits below the fold there. That was
  2.8 s of scripting under throttling. The live map now mounts only when its
  frame comes within 200 px of the viewport and the browser is idle. Until
  then, the server-rendered SVG of the same routes shows. Mobile went from 59
  to 89.
- **Run 2 to run 3.** Mobile CLS was 0.0008. The cause: the header's language
  button sat behind a Suspense boundary because it read `useSearchParams`
  during render. It now reads the query only when a language is chosen, so it
  renders on the server and nothing moves.
- **Variance:** run-to-run variance for mobile Performance is about ±2 points
  (89 and 88 across the last two runs).

**Accessibility 100 on other pages** (Lighthouse accessibility and best
practices only): `/navigate`, `/settings`, `/coverage`.

**Not measured yet:**
- A deployed host.
- A field test on a mid-range Android phone. That needs a device.

## Web: interaction latency

**Setup.** Measured on the production containers, with the CPU throttled 4× to
approximate a mid-range Android phone (`scripts/interaction-latency.mjs`, plus
Chrome traces of single interactions).

**What was slow, and what changed.**
- **The bottom sheet re-rendered the whole planner on every animation frame.**
  It reported its height through React state. The height now lives in a tiny
  external store that only the map subscribes to. The sheet also owns its snap
  position.
- **Every route switch re-rendered every route card.** The cards are now
  memoized, with id-based callbacks.
- **A new empty array was created on every render for hazards,** which tore
  down and rebuilt the map's hazard markers each time.
- **Map animations were expensive per frame:**
  - The draw-on changed filters on six layers every frame. It now reveals the
    route in 8 steps.
  - The flow highlight rewrote a line gradient 20 times a second. It now ticks
    10 times a second and pauses during the draw-on, camera moves and hidden
    tabs.

**Result for a route switch on the mobile planner** (Chrome trace, 1.5 s after
the tap, 4× CPU throttle):

| | Before | After |
| --- | ---: | ---: |
| Main-thread busy time | 660 ms | 435–451 ms |
| Longest task | 133 ms | 59–70 ms |

The input itself costs 30–50 ms: the click, React's update, and starting the map
transition. The longest remaining tasks are map frames.

**Measurement caveats, stated plainly:**
- Headless Chromium draws WebGL on the CPU (SwiftShader). Map frames here are
  much more expensive than on a phone's GPU.
- In mobile emulation, the Event Timing API also reported presentation delays of
  up to about 500 ms. These did not correspond to main-thread work: the same tap
  traced with WebGL disabled has a longest task of 29 ms.
- A real mid-range Android device test is still needed before claiming an INP
  figure.

**Other performance choices:**
- The LCP element is the server-rendered `h1`, which never animates.
- The hero ships precomputed, simplified geometry (one point every 35 m), not
  the 545 KB corridor fixture.
- Only two font weights ship.
