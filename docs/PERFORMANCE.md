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

**Not yet measured:**
- Latency on the deployed host. There is no deployment yet.
- A full North York graph. Only the corridor is loaded.

The Rust (PyO3) hot path from the spec remains a stretch goal only. On this data
Python meets the targets, so moving to Rust is not justified yet.

## Web

| Measure | Result | How |
| --- | --- | --- |
| Lighthouse (mobile/desktop) | not yet measured | `@lhci/cli` is planned for CI |
| Field test on a mid-range Android phone | not done | needs a device |

Choices made for performance:
- The landing headline and the search field are server-rendered and never
  animated, so the LCP is text.
- The hero map loads only after hydration, and only when WebGL works and motion
  is allowed. Until then the server-rendered SVG of the same routes is shown.
- The hero ships precomputed, simplified geometry (one point every 35 m), not the
  545 KB corridor fixture.
- MapLibre and its worker are lazy-loaded. Only two font weights ship.
