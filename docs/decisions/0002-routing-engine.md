# 0002. Routing engine: in-process evidence router now, benchmark before choosing an engine

- Status: accepted as interim; the engine benchmark is still open
- Date: 2026-11-03
- Evidence: [PERFORMANCE.md](../PERFORMANCE.md), `services/api/tests/test_api.py`

## Context

The spec asks for a choice between three engines, made by measurement on 50
real corridor trips:

- Valhalla pedestrian costing
- OpenTripPlanner 2 wheelchair routing
- pgRouting with a custom cost

The comparison covers correctness, how flexible per-person costs are, and p95
latency.

That benchmark has not been run. Docker only became available on this machine
partway through the build, and each engine needs its own graph build.

PathAble's costs are unusual. They depend on per-attribute evidence and on each
person's thresholds, with a margin around every measured value (ADR 0001). None
of the three engines has these semantics built in:

- **Valhalla** exposes a fixed set of costing options (`max_grade`,
  `step_penalty`, and so on). It has no notion of "unknown within the error
  margin".
- **OpenTripPlanner** has wheelchair slope and step penalties, but evidence
  states would have to be pre-baked into the graph per preference set.
- **pgRouting** can run any SQL cost, so it is the most flexible. Its latency
  depends on extracting a subgraph per request.

## Decision

**For now:** the API uses an in-process router (`pathable_api.routing.EvidenceGraph`):
- Dijkstra over a networkx graph built from the PostGIS `edges` table at
  startup;
- costs from the shared scoring rules, cached per preference set;
- alternatives produced by penalising edges already used, with a maximum overlap
  of 80%.

The same code produces the development fixtures, so live and frozen answers
cannot drift apart. A test asserts they agree.

**The engine decision** waits for the benchmark. It will use the 50 trips in
`infra/k6/trips.json` and measure:
1. **Correctness.** Each route must respect hard constraints (no steps when
   avoided) and must not use edges the evidence marks as barriers.
2. **Flexibility.** Can a per-request change of threshold be expressed without
   rebuilding the graph?
3. **Latency.** p95 and p99 under the k6 profile in `PERFORMANCE.md`.

## Consequences

- **Cost:** the graph lives in each worker's memory. For the 6,067-edge corridor
  that is small. The size of a full North York build has not been measured
  and must be before deployment.
- **Today's results:** p95 121 ms and p99 137 ms on corridor trips with 6
  workers, which meets the targets. The interim router is good enough to ship
  the pilot, and the benchmark has a baseline to beat.
- **Limits:** routing is CPU-bound Python. Under 2 workers, hazard requests
  queued behind it (p95 153 ms). Worker count must exceed the expected
  concurrent route requests.
