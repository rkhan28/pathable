"""Engine benchmark for docs/decisions/0002-routing-engine.md.

Runs the 50 corridor trips in infra/k6/trips.json through three engines and
judges every resulting route against the same evidence, with the default
preferences:

  pathable   in-process A* over the evidence graph (pathable_api.routing)
  pgrouting  pgr_dijkstra, edge costs computed in SQL from the evidence per request
  valhalla   pedestrian costing, type=wheelchair (Valhalla has no evidence states)

Correctness: each route's geometry is sampled every 5 m and matched to the
nearest evidence edge within 8 m; the matched length is classified with the
shared rules. Latency: best single path, 3 warm runs per trip, wall clock from
the caller's side.

Usage (PostGIS+pgRouting on 5433 loaded with the corridor, Valhalla on 8002):
  uv run python scripts/engine_bench.py > ../../docs/data/engine_bench.json
"""

from __future__ import annotations

import itertools
import json
import statistics
import sys
import time
from pathlib import Path

import httpx
import psycopg

from pathable_api.db import Database
from pathable_api.routing import EvidenceGraph, metres
from pathable_api.scoring import STATE_WEIGHT, segment_state

ROOT = Path(__file__).resolve().parents[3]
TRIPS = json.loads((ROOT / "infra/k6/trips.json").read_text())
PREFS = json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text())
PG = "postgresql://pathable:pathable@localhost:5433/pathable"
VALHALLA = "http://localhost:8002/route"
RUNS = 3
SAMPLE_M = 5.0
MATCH_M = 8.0


def percentile(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    return xs[min(len(xs) - 1, round(p / 100 * (len(xs) - 1)))]


class Judge:
    """Classifies any polyline against PathAble's evidence graph."""

    def __init__(self, graph: EvidenceGraph):
        self.graph = graph
        self.state = {
            pid: segment_state({"id": pid, "evidence": list(p.evidence)}, PREFS, []) for pid, p in graph.pieces.items()
        }
        self._index_segments()

    def _index_segments(self) -> None:
        # Every graph segment is registered in each ~200 m cell it touches, so a
        # sample point only measures against nearby segments.
        from pathable_api.routing import cell

        self._seg_cells: dict[tuple[int, int], list] = {}
        for a, b, d in self.graph.g.edges(data=True):
            n = max(1, int(metres(a, b) // 50) + 1)
            cells = {cell((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) for i in range(n + 1)}
            for c in cells:
                self._seg_cells.setdefault(c, []).append((a, b, d["piece"]))

    def _piece_at(self, p) -> str | None:
        from pathable_api.routing import cell

        cx, cy = cell(p)
        best, best_d = None, MATCH_M
        k = 0.7225  # cos(43.77 deg): equirectangular is exact enough over a few metres
        for dx_ in (-1, 0, 1):
            for dy_ in (-1, 0, 1):
                for a, b, piece in self._seg_cells.get((cx + dx_, cy + dy_), ()):
                    dx, dy = (b[0] - a[0]) * k, b[1] - a[1]
                    denom = dx * dx + dy * dy
                    t = 0.0 if denom == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * k * dx + (p[1] - a[1]) * dy) / denom))
                    dist = metres(p, (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
                    if dist < best_d:
                        best, best_d = piece, dist
        return best

    def score(self, coords: list) -> dict:
        out = {"verified": 0.0, "barrier": 0.0, "unknown": 0.0, "unmatched": 0.0, "steps": 0}
        seen_steps = set()
        for a, b in itertools.pairwise(coords):
            seg = metres(a, b)
            n = max(1, int(seg // SAMPLE_M))
            for i in range(n):
                t = (i + 0.5) / n
                p = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
                pid = self._piece_at(p)
                if pid is None:
                    out["unmatched"] += seg / n
                    continue
                out[self.state[pid]] += seg / n
                if self.graph.pieces[pid].kind == "steps" and pid not in seen_steps:
                    seen_steps.add(pid)
                    out["steps"] += 1
        out["distance"] = sum(out[k] for k in ("verified", "barrier", "unknown", "unmatched"))
        out["cost"] = sum(out[k] * STATE_WEIGHT[k] for k in ("verified", "barrier", "unknown"))
        return out


def run_pathable(graph: EvidenceGraph, trip) -> tuple[list, float]:
    multiplier = graph._multipliers(tuple(sorted(PREFS.items())))
    start = time.perf_counter()
    src, _ = graph.nearest(tuple(trip["origin"]))
    dst, _ = graph.nearest(tuple(trip["destination"]))
    path = graph._path(src, dst, lambda _a, _b, d: d["length"] * multiplier[d["piece"]])
    return [list(n) for n in path], time.perf_counter() - start


PGR_SQL = """
WITH s AS (SELECT id FROM bench_vertices ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%(ox)s, %(oy)s), 4326) LIMIT 1),
     t AS (SELECT id FROM bench_vertices ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%(dx)s, %(dy)s), 4326) LIMIT 1)
SELECT ST_X(v.geom), ST_Y(v.geom)
FROM pgr_dijkstra(
  format($q$
    SELECT b.id, b.source, b.target, b.length_m * w.w AS cost, b.length_m * w.w AS reverse_cost
    FROM bench_edges b
    JOIN (SELECT id, pa_weight(evidence, %%L::jsonb) AS w FROM edges
          WHERE geom && ST_Expand(ST_MakeEnvelope(%%s, %%s, %%s, %%s, 4326), 0.01)) w ON w.id = b.piece_id
  $q$, %(prefs)s::text, %(w)s::float8, %(s)s::float8, %(e)s::float8, %(n)s::float8),
  (SELECT id FROM s), (SELECT id FROM t), directed => false) r
JOIN bench_vertices v ON v.id = r.node
ORDER BY r.seq
"""


def run_pgrouting(conn, trip) -> tuple[list, float]:
    (ox, oy), (dx, dy) = trip["origin"], trip["destination"]
    params = {
        "ox": ox, "oy": oy, "dx": dx, "dy": dy, "prefs": json.dumps(PREFS),
        "w": min(ox, dx), "s": min(oy, dy), "e": max(ox, dx), "n": max(oy, dy),
    }  # fmt: skip
    start = time.perf_counter()
    rows = conn.execute(PGR_SQL, params).fetchall()
    return [list(r) for r in rows], time.perf_counter() - start


def decode_polyline6(s: str) -> list:
    coords, index, lat, lon = [], 0, 0, 0
    while index < len(s):
        for which in (0, 1):
            shift = result = 0
            while True:
                b = ord(s[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if which == 0:
                lat += delta
            else:
                lon += delta
        coords.append([lon / 1e6, lat / 1e6])
    return coords


def run_valhalla(client: httpx.Client, trip) -> tuple[list, float]:
    body = {
        "locations": [
            {"lon": trip["origin"][0], "lat": trip["origin"][1]},
            {"lon": trip["destination"][0], "lat": trip["destination"][1]},
        ],
        "costing": "pedestrian",
        "costing_options": {"pedestrian": {"type": "wheelchair"}},
    }
    start = time.perf_counter()
    res = client.post(VALHALLA, json=body)
    elapsed = time.perf_counter() - start
    if res.status_code != 200:
        return [], elapsed
    shape = res.json()["trip"]["legs"][0]["shape"]
    return decode_polyline6(shape), elapsed


def main() -> None:
    db = Database(PG)
    graph = EvidenceGraph(db.pieces(db.latest_version()["id"]))
    judge = Judge(graph)
    engines = {}
    with psycopg.connect(PG, autocommit=True) as conn, httpx.Client(timeout=30) as client:
        runners = {
            "pathable": lambda t: run_pathable(graph, t),
            "pgrouting": lambda t: run_pgrouting(conn, t),
            "valhalla": lambda t: run_valhalla(client, t),
        }
        for name, run in runners.items():
            times, scores, failures = [], [], 0
            for trip in TRIPS:
                coords, _ = run(trip)  # warm-up, also the route we judge
                for _ in range(RUNS):
                    times.append(run(trip)[1] * 1000)
                if len(coords) < 2:
                    failures += 1
                    continue
                scores.append(judge.score(coords))
            total = {
                k: sum(s[k] for s in scores)
                for k in ("distance", "verified", "barrier", "unknown", "unmatched", "cost")
            }
            engines[name] = {
                "routes": len(scores),
                "failures": failures,
                "latency_ms": {
                    "p50": round(statistics.median(times), 1),
                    "p95": round(percentile(times, 95), 1),
                    "p99": round(percentile(times, 99), 1),
                },
                "routes_with_barriers": sum(1 for s in scores if s["barrier"] > 0),
                "routes_using_steps": sum(1 for s in scores if s["steps"] > 0),
                "share_pct": {
                    k: round(100 * total[k] / total["distance"], 1)
                    for k in ("verified", "barrier", "unknown", "unmatched")
                },
                "total_km": round(total["distance"] / 1000, 2),
                "evidence_cost_km": round(total["cost"] / 1000, 2),
            }
            print(name, json.dumps(engines[name]), file=sys.stderr)
    print(json.dumps({"trips": len(TRIPS), "runs_per_trip": RUNS, "preferences": PREFS, "engines": engines}, indent=2))


if __name__ == "__main__":
    main()
