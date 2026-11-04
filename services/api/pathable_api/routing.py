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


REPORT_MATCH_M = 15.0  # a report further than this from every edge is not on the network


class _Overlay(Mapping):
    """A read-only view of cached multipliers with a few per-request overrides."""

    def __init__(self, base: Mapping[str, float], overrides: Mapping[str, float]):
        self._base, self._overrides = base, overrides

    def __getitem__(self, key: str) -> float:
        return self._overrides.get(key) or self._base[key]

    def __iter__(self):
        return iter(self._base)

    def __len__(self) -> int:
        return len(self._base)


CELL_DEG = 0.002  # about 160 m east-west and 220 m north-south at Toronto's latitude


def cell(p: LonLat) -> tuple[int, int]:
    return (math.floor(p[0] / CELL_DEG), math.floor(p[1] / CELL_DEG))


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
        # Component id per node, so "is there any path?" is a dict lookup, not a search.
        self._component: dict[LonLat, int] = {}
        for i, nodes in enumerate(nx.connected_components(self.g)):
            for n in nodes:
                self._component[n] = i
        # Nodes bucketed into ~200 m cells, so snapping looks at a few cells instead of every node.
        self._cells: dict[tuple[int, int], list[LonLat]] = {}
        for n in self.g.nodes:
            self._cells.setdefault(cell(n), []).append(n)

    def nearest(self, p: LonLat) -> tuple[LonLat, float]:
        cx, cy = cell(p)
        candidates = [n for dx in (-1, 0, 1) for dy in (-1, 0, 1) for n in self._cells.get((cx + dx, cy + dy), ())]
        if not candidates:
            return p, math.inf
        best = min(candidates, key=lambda n: metres(n, p))
        return best, metres(best, p)

    def _path(self, src: LonLat, dst: LonLat, weight) -> list:
        # A* with straight-line distance: admissible because every cost is length x a multiplier of at least 1.
        return nx.astar_path(self.g, src, dst, heuristic=lambda a, _b: metres(a, dst), weight=weight)

    def piece_near(self, p: LonLat, max_m: float = REPORT_MATCH_M) -> str | None:
        """The edge piece passing closest to p, if one is within max_m metres."""
        cx, cy = cell(p)
        best, best_d = None, max_m
        k = math.cos(math.radians(p[1]))
        for dx_ in (-1, 0, 1):
            for dy_ in (-1, 0, 1):
                for node in self._cells.get((cx + dx_, cy + dy_), ()):
                    for nb in self.g.neighbors(node):
                        ax, ay = node
                        bx, by = nb
                        vx, vy = (bx - ax) * k, by - ay
                        denom = vx * vx + vy * vy
                        t = 0.0 if denom == 0 else max(0.0, min(1.0, ((p[0] - ax) * k * vx + (p[1] - ay) * vy) / denom))
                        d = metres(p, (ax + t * (bx - ax), ay + t * (by - ay)))
                        if d < best_d:
                            best, best_d = self.g.edges[node, nb]["piece"], d
        return best

    def route(
        self, origin: LonLat, destination: LonLat, prefs: Mapping, reports: Sequence[Mapping] = ()
    ) -> list[dict] | None:
        """Up to three structurally different, ranked alternatives, or None.

        Open community reports are matched to the edge they lie on. With
        "avoid reported obstacles" on, those edges cost what their state would:
        a reported obstacle like an unverified stretch, a verified one like a
        barrier. Every route that uses the edge carries the report as a hazard.
        """
        src, d1 = self.nearest(origin)
        dst, d2 = self.nearest(destination)
        if max(d1, d2) > SNAP_RADIUS_M or self._component[src] != self._component[dst]:
            return None
        on_piece: dict[str, list[Mapping]] = {}
        for r in reports:
            pid = self.piece_near(tuple(r["location"]))
            if pid:
                on_piece.setdefault(pid, []).append(r)
        multiplier: Mapping[str, float] = self._multipliers(tuple(sorted(prefs.items())))
        if on_piece and prefs["avoidReportedObstacles"]:
            overrides = {
                pid: STATE_WEIGHT["barrier" if any(r["status"] == "verified" for r in rs) else "unverified"]
                for pid, rs in on_piece.items()
            }
            multiplier = _Overlay(multiplier, overrides)
        paths = self._alternatives(src, dst, multiplier)
        routes = [self._to_route(path, f"r-{chr(97 + i)}", on_piece) for i, path in enumerate(paths)]
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

    def walk_tree(self, origin: LonLat, prefs: Mapping, cutoff_m: float) -> tuple[LonLat, dict, dict] | None:
        """Cheapest walks (by evidence cost) from origin to every node within cutoff_m of walking.

        One search serves every nearby transit stop at once. Returns
        (snapped origin node, cost by node, path by node), or None when the
        origin is not near the network.
        """
        src, d = self.nearest(origin)
        if d > SNAP_RADIUS_M:
            return None
        multiplier = self._multipliers(tuple(sorted(prefs.items())))
        cost, paths = nx.single_source_dijkstra(
            self.g, src, cutoff=cutoff_m * 2, weight=lambda _a, _b, e: e["length"] * multiplier[e["piece"]]
        )
        lengths = {n: sum(self.g.edges[a, b]["length"] for a, b in itertools.pairwise(p)) for n, p in paths.items()}
        reachable = {n: p for n, p in paths.items() if lengths[n] <= cutoff_m}
        return src, {n: cost[n] for n in reachable}, reachable

    def walk_route(self, path: list, route_id: str, prefs: Mapping) -> dict:
        """A single walking route along a node path, with states, steps and freshness."""
        return finalize([self._to_route(path, route_id)], prefs)[0]

    def _alternatives(self, src, dst, multiplier: Mapping[str, float]) -> list[list]:
        def lengths(path):
            out: dict[str, float] = {}
            for a, b in itertools.pairwise(path):
                e = self.g.edges[a, b]
                out[e["piece"]] = out.get(e["piece"], 0) + e["length"]
            return out

        def overlap(p, q):
            lp, lq = lengths(p), lengths(q)
            if not lp or not lq:
                return 1.0  # an empty path (both ends on one node) is the same as any other
            shared = sum(min(v, lq.get(k, 0)) for k, v in lp.items())
            return shared / max(1e-9, min(sum(lp.values()), sum(lq.values())))

        def by_state(_a, _b, d):
            return d["length"] * multiplier[d["piece"]]

        found = [self._path(src, dst, by_state)]
        shortest = self._path(src, dst, "length")
        if overlap(shortest, found[0]) < MAX_OVERLAP:
            found.append(shortest)
        penalty = 2.0
        while len(found) < 3 and penalty <= 64:
            used = set().union(*(lengths(p) for p in found))

            def weight(_a, _b, d, used=used, penalty=penalty):
                return d["length"] * multiplier[d["piece"]] * (penalty if d["piece"] in used else 1)

            candidate = self._path(src, dst, weight)
            if all(overlap(candidate, p) < MAX_OVERLAP for p in found):
                found.append(candidate)
            penalty *= 2
        return found

    def _to_route(self, path: list, route_id: str, reports: Mapping[str, list[Mapping]] | None = None) -> dict:
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
            hazards.extend({**r, "segmentId": seg_id} for r in (reports or {}).get(pid, ()))
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


# Below these lengths a change of street name is mapping noise, not a step a
# person would act on: a sidewalk corner tagged with the side street, or the
# few metres between a crossing and the next name change.
FLAP_M = 40.0
STUB_M = 12.0
# Just after a crossing, the corner of the street crossed is often mapped under its
# name ("cross Fine Arts Road, then 17 m along Fine Arts Road"); that is not a step.
AFTER_CROSSING_STUB_M = 25.0


def group_steps(segments: list[dict]) -> list[dict]:
    """Group consecutive segments into steps, then smooth out steps nobody would act on.

    Each group keeps `anchor`, the segment where its maneuver is measured. It is
    usually the first, but when a stub is folded into the step after it, the
    turn is still measured where the street actually changes.
    """
    groups: list[dict] = []
    for s in segments:
        crossing = s["kind"] == "crossing"
        last = groups[-1] if groups else None
        if last and last["crossing"] == crossing and last["name"] == s["streetName"]:
            last["segs"].append(s)
        else:
            groups.append({"segs": [s], "crossing": crossing, "name": s["streetName"], "anchor": 0})

    def length(g: dict) -> float:
        return sum(s["lengthM"] for s in g["segs"])

    def walk(g: dict | None) -> bool:
        return g is not None and not g["crossing"]

    # A short stretch under another name between two stretches of the same street
    # ("Ian Macdonald, Fine Arts for 20 m, Ian Macdonald") is one step along that street.
    i = 1
    while i < len(groups) - 1:
        a, b, c = groups[i - 1], groups[i], groups[i + 1]
        if walk(a) and walk(b) and walk(c) and a["name"] == c["name"] and length(b) < FLAP_M:
            a["segs"] += b["segs"] + c["segs"]
            del groups[i : i + 2]
        else:
            i += 1

    # A few metres of walking with a name of its own joins its neighbour: the step
    # before it if that is walking too, otherwise the one after.
    i = 0
    while i < len(groups):
        g = groups[i]
        before = groups[i - 1] if i > 0 else None
        after = groups[i + 1] if i + 1 < len(groups) else None
        limit = AFTER_CROSSING_STUB_M if before is not None and before["crossing"] else STUB_M
        if i > 0 and walk(g) and length(g) < limit:
            if walk(before):
                before["segs"] += g["segs"]
                del groups[i]
                continue
            if walk(after):
                after["anchor"] = len(g["segs"])
                after["segs"] = g["segs"] + after["segs"]
                del groups[i]
                continue
        i += 1
    return groups


def build_steps(route: dict, prefs: Mapping) -> list[dict]:
    coords = route["geometry"]
    groups = group_steps(route["segments"])
    steps, prev = [], None
    for i, group in enumerate(groups):
        grp = group["segs"]
        start, end = grp[0]["from"], grp[-1]["to"]
        # The direction coming into the anchor, compared with the direction leaving it.
        pivot = grp[group["anchor"]]["from"]
        incoming = prev if group["anchor"] == 0 else bearing(coords[max(pivot - 1, 0)], coords[pivot])
        first = bearing(coords[pivot], coords[min(pivot + 1, len(coords) - 1)])
        maneuver = "depart" if i == 0 else "cross" if group["crossing"] else turn(incoming, first)
        prev = bearing(coords[max(end - 1, 0)], coords[end])
        notes: list[str] = []
        evidence = [e for s in grp for e in s["evidence"]]

        def add(note: str, notes=notes) -> None:
            if note not in notes:
                notes.append(note)

        for e in evidence:
            if e["attribute"] == "aps":
                add("aps_present" if e["value"] is True else "aps_absent" if e["value"] is False else "aps_unknown")
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
                "streetName": group["name"],
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
