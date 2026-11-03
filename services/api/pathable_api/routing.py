"""Alternative routes over the evidence graph, as contract-shaped dicts.

The single implementation used by the API (edges loaded from PostGIS) and by
pipelines/demo_fixtures.py (edges built in memory). Interim engine: an
in-process Dijkstra over networkx, chosen until the engine benchmark in
docs/decisions/0002-routing-engine.md is run.
"""

from __future__ import annotations

import functools
import itertools
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

import networkx as nx

from .scoring import STATE_WEIGHT, rank_routes, segment_state

WALK_SPEED_MPS = 1.0  # the pedestrian walking speed Toronto uses for signal timing
MAX_OVERLAP = 0.8
SNAP_RADIUS_M = 150

LonLat = tuple[float, float]


@dataclass(frozen=True)
class Piece:
    id: str
    kind: str
    street: str | None
    coords: tuple[LonLat, ...]
    evidence: tuple[Mapping, ...]
    hazards: tuple[Mapping, ...] = field(default=())


def metres(a: LonLat, b: LonLat) -> float:
    k = math.pi / 180
    x = (b[0] - a[0]) * k * math.cos((a[1] + b[1]) / 2 * k)
    y = (b[1] - a[1]) * k
    return math.hypot(x, y) * 6_371_000


def key(p: LonLat) -> LonLat:
    return (round(p[0], 7), round(p[1], 7))


class EvidenceGraph:
    def __init__(self, pieces: Sequence[Piece]):
        self.pieces = {p.id: p for p in pieces}
        self.g = nx.Graph()
        for p in pieces:
            for a, b in zip(p.coords, p.coords[1:], strict=False):
                ka, kb = key(a), key(b)
                if ka != kb:
                    self.g.add_edge(ka, kb, piece=p.id, length=metres(a, b))
        self._nodes = list(self.g.nodes)

    def nearest(self, p: LonLat) -> tuple[LonLat, float]:
        best = min(self._nodes, key=lambda n: metres(n, p))
        return best, metres(best, p)

    def route(self, origin: LonLat, destination: LonLat, prefs: Mapping) -> list[dict] | None:
        """Up to three structurally different, ranked alternatives, or None."""
        src, d1 = self.nearest(origin)
        dst, d2 = self.nearest(destination)
        if max(d1, d2) > SNAP_RADIUS_M or not nx.has_path(self.g, src, dst):
            return None
        multiplier = self._multipliers(tuple(sorted(prefs.items())))
        paths = self._alternatives(src, dst, multiplier)
        routes = [self._to_route(path, f"r-{chr(97 + i)}") for i, path in enumerate(paths)]
        return finalize(routes, prefs)

    @functools.lru_cache(maxsize=64)  # noqa: B019 -- one graph per process; bounded by distinct preference sets
    def _multipliers(self, prefs_key: tuple) -> dict[str, float]:
        """Cost multiplier per piece for one set of preferences. Read-only: the shared graph is never mutated,
        so concurrent requests with different preferences cannot interfere."""
        prefs = dict(prefs_key)
        return {
            pid: STATE_WEIGHT[segment_state({"id": pid, "evidence": list(p.evidence)}, prefs, [])]
            for pid, p in self.pieces.items()
        }

    def _alternatives(self, src, dst, multiplier: Mapping[str, float]) -> list[list]:
        def lengths(path):
            out: dict[str, float] = {}
            for a, b in itertools.pairwise(path):
                e = self.g.edges[a, b]
                out[e["piece"]] = out.get(e["piece"], 0) + e["length"]
            return out

        def overlap(p, q):
            lp, lq = lengths(p), lengths(q)
            shared = sum(min(v, lq.get(k, 0)) for k, v in lp.items())
            return shared / max(1e-9, min(sum(lp.values()), sum(lq.values())))

        def by_state(_a, _b, d):
            return d["length"] * multiplier[d["piece"]]

        found = [nx.shortest_path(self.g, src, dst, weight=by_state)]
        shortest = nx.shortest_path(self.g, src, dst, weight="length")
        if overlap(shortest, found[0]) < MAX_OVERLAP:
            found.append(shortest)
        penalty = 2.0
        while len(found) < 3 and penalty <= 64:
            used = set().union(*(lengths(p) for p in found))

            def weight(_a, _b, d, used=used, penalty=penalty):
                return d["length"] * multiplier[d["piece"]] * (penalty if d["piece"] in used else 1)

            candidate = nx.shortest_path(self.g, src, dst, weight=weight)
            if all(overlap(candidate, p) < MAX_OVERLAP for p in found):
                found.append(candidate)
            penalty *= 2
        return found

    def _to_route(self, path: list, route_id: str) -> dict:
        geometry = [[round(n[0], 6), round(n[1], 6)] for n in path]
        segments, hazards, idx = [], [], 0
        runs: list[tuple[str, list]] = []
        for a, b in itertools.pairwise(path):
            pid = self.g.edges[a, b]["piece"]
            if runs and runs[-1][0] == pid:
                runs[-1][1].append(b)
            else:
                runs.append((pid, [a, b]))
        for n, (pid, nodes) in enumerate(runs):
            piece = self.pieces[pid]
            length = sum(metres(a, b) for a, b in itertools.pairwise(nodes))
            seg_id = f"{route_id}-{n}-{pid}"
            segments.append(
                {
                    "id": seg_id,
                    "from": idx,
                    "to": idx + len(nodes) - 1,
                    "lengthM": round(length, 1),
                    "kind": piece.kind,
                    "streetName": piece.street,
                    "state": "unknown",
                    "evidence": [dict(e) for e in piece.evidence],
                }
            )
            hazards.extend({**h, "segmentId": seg_id} for h in piece.hazards)
            idx += len(nodes) - 1
        distance = sum(s["lengthM"] for s in segments)
        return {
            "id": route_id,
            "geometry": geometry,
            "distanceM": round(distance, 1),
            "durationS": round(distance / WALK_SPEED_MPS),
            "segments": segments,
            "hazards": hazards,
        }


def bearing(a, b) -> float:
    k = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.degrees(math.atan2((b[0] - a[0]) * k, b[1] - a[1])) % 360


def turn(prev: float, nxt: float) -> str:
    d = (nxt - prev + 540) % 360 - 180
    if abs(d) < 20:
        return "continue"
    if abs(d) < 45:
        return "slight_right" if d > 0 else "slight_left"
    return "turn_right" if d > 0 else "turn_left"


def kerb_note(value) -> str:
    if not isinstance(value, str) or ";" not in value:
        return "kerbs_unknown"
    ends = value.split(";")
    if "raised" in ends:
        return "kerb_raised"
    return "kerbs_lowered" if all(k in ("lowered", "flush", "no") for k in ends) else "kerbs_unknown"


def build_steps(route: dict, prefs: Mapping) -> list[dict]:
    coords = route["geometry"]
    groups: list[list[dict]] = []
    for s in route["segments"]:
        crossing = s["kind"] == "crossing"
        if (
            groups
            and (groups[-1][0]["kind"] == "crossing") == crossing
            and groups[-1][0]["streetName"] == s["streetName"]
        ):
            groups[-1].append(s)
        else:
            groups.append([s])
    steps, prev = [], None
    for i, grp in enumerate(groups):
        start, end = grp[0]["from"], grp[-1]["to"]
        first = bearing(coords[start], coords[min(start + 1, len(coords) - 1)])
        maneuver = "depart" if i == 0 else "cross" if grp[0]["kind"] == "crossing" else turn(prev, first)
        prev = bearing(coords[max(end - 1, 0)], coords[end])
        notes: list[str] = []
        evidence = [e for s in grp for e in s["evidence"]]

        def add(note: str, notes=notes) -> None:
            if note not in notes:
                notes.append(note)

        for e in evidence:
            if e["attribute"] == "aps" and e["value"] is True:
                add("aps_present")
            if e["attribute"] == "kerbs":
                add(kerb_note(e["value"]))
            if e["attribute"] == "steps" and e["value"] is True:
                add("steps")
        if any(e["attribute"] == "surface" and e["value"] is None for e in evidence):
            add("surface_unknown")
        if any(s["state"] == "barrier" for s in grp) and any(
            e["attribute"] == "running_slope"
            and isinstance(e["value"], int | float)
            and e["value"] > prefs["maxRunningSlopePct"]
            for e in evidence
        ):
            add("slope_steep")
        if any(h["segmentId"] in {s["id"] for s in grp} and h["status"] == "reported" for h in route["hazards"]):
            add("hazard_reported")
        steps.append(
            {
                "maneuver": maneuver,
                "streetName": grp[0]["streetName"],
                "distanceM": round(sum(s["lengthM"] for s in grp), 1),
                "segmentIds": [s["id"] for s in grp],
                "at": start,
                "notes": notes,
            }
        )
    steps.append(
        {
            "maneuver": "arrive",
            "streetName": None,
            "distanceM": 0,
            "segmentIds": [],
            "at": len(coords) - 1,
            "notes": [],
        }
    )
    return steps


def finalize(routes: list[dict], prefs: Mapping) -> list[dict]:
    """Apply states, ranks and reasons with the shared rules; add steps and freshness."""
    ranked = {s.id: s for s in rank_routes(routes, prefs)}
    for r in routes:
        s = ranked[r["id"]]
        for seg in r["segments"]:
            seg["state"] = s.states[seg["id"]]
        dates = [e["observedOn"] for seg in r["segments"] for e in seg["evidence"] if e.get("observedOn")]
        r.update(
            steps=build_steps(r, prefs),
            lengthByState={k: round(v, 1) for k, v in s.length_by_state.items()},
            barrierCount=s.barrier_count,
            reportCount=s.report_count,
            oldestObservation=min(dates) if dates else None,
            newestObservation=max(dates) if dates else None,
            compatibility=s.compatibility,
            rank=s.rank,
            score=s.score,
            reasons=s.reasons,
        )
    return sorted(routes, key=lambda r: r["rank"])
