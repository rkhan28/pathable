# 0002. Routing engine: keep the in-process evidence router

- Status: accepted. Benchmarked 2026-11-03 against pgRouting and Valhalla; OpenTripPlanner not yet run.
- Date: 2026-11-03
- Evidence: `docs/data/engine_bench.json` (from `services/api/scripts/engine_bench.py`), [PERFORMANCE.md](../PERFORMANCE.md)

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

## Benchmark results (2026-11-03)

**Setup.**
- The same 50 corridor trips as the k6 benchmark, with the default preferences.
- Latency is for the best single path: 3 warm runs per trip, measured from the
  caller.
- Every route is judged against PathAble's evidence. Its geometry is sampled
  every 5 m and matched to the nearest evidence edge within 8 m, then
  classified with the shared rules.
- "Evidence cost" is Σ length × state weight (ROUTE_RANKING.md). Lower is
  better.

| Engine | How costs are set | p50 | p95 | p99 | Verified | Barrier | Unknown | Off our network | Routes with a barrier | Routes using steps | Evidence cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PathAble in-process | shared rules, cached per preference set | 2.5 ms | 9.5 ms | 10.1 ms | 64.9% | 3.9% | 31.2% | 0% | 34 / 50 | 5 | 158.0 km |
| pgRouting 4.0.2 | the same rules in PL/pgSQL, per request | 510 ms | 726 ms | 739 ms | 64.8% | 3.9% | 31.3% | 0% | 35 / 50 | 5 | 158.0 km |
| Valhalla 3.9.1 | `pedestrian`, `type: wheelchair` | 3.0 ms | 5.1 ms | 5.5 ms | 22.3% | 14.5% | 40.6% | 22.6% | 43 / 50 | 2 | 187.3 km |

**Correctness check for pgRouting.** The PL/pgSQL state function agrees with
the Python and TypeScript rules on all 24 shared segment cases. It also finds
the same routes as the in-process router, which confirms the cost function was
reproduced faithfully.

**Reading the results.**
- **pgRouting** has the flexibility: any per-request cost written in SQL. But
  computing evidence costs per request for the trip's subgraph costs about
  0.5 s at p50, roughly 200× the in-process router.
  - Precomputing a weight table per preference set would close part of that gap.
  - It would also bring back the cache the in-process router already has, in
    the database instead.
- **Valhalla** is the fastest engine and very robust, but it cannot see the
  evidence. Judged by PathAble's evidence:
  - its wheelchair routes are 18.5% more expensive;
  - 14.5% of their length is a known barrier, against 3.9%;
  - only 22.3% is verified, against 64.9%;
  - 22.6% runs on ways outside PathAble's network, such as road centrelines
    where a separate sidewalk exists. Those stretches cannot be described, so
    they could not be shown honestly.
  - Making Valhalla evidence-aware would mean a custom costing model in C++.
- **The in-process router** is evidence-aware by construction, fast enough with
  a large margin, and needs no extra service.

**Decision.** Keep the in-process router. Re-run this benchmark when the full
North York graph is loaded, and if a preference set needs hard constraints
rather than costs.

**Not yet benchmarked: OpenTripPlanner 2.** Its wheelchair model reads slope
from its own elevation input. A fair run means building its graph with the same
lidar terrain model, which is still to do.

**Product finding.** With the default preferences, 5 of 50 PathAble routes
still use steps, and 34 of 50 cross at least one barrier. Barriers are a cost
(×6), not a prohibition, so when no alternative exists the planner shows the
least-bad route and marks it "has known barriers". This is honest. It also
argues for an opt-in "never" setting for steps, which would make the person's
hard limits hard.
