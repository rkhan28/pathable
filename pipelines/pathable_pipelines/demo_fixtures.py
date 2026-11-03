"""Compute the development fixtures from the real North York graph.

Usage: uv run python -m pathable_pipelines.demo_fixtures

Fixtures are real alternatives computed from real data. They are still
labelled ``development-fixture`` because they are a frozen snapshot served
without the live API, and the web app shows that label everywhere they are used.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
from pathable_api.scoring import STATE_WEIGHT, rank_routes, segment_state
from shapely.geometry import LineString, MultiPoint

from . import graph as graphmod
from . import osm
from .reality_check import CORRIDOR_STATIONS, METRIC, RAW, corridor

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "contracts" / "fixtures" / "routes"
DEFAULT_PREFS = json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text())
WALK_SPEED_MPS = 1.0  # the pedestrian walking speed Toronto uses for signal timing
TRIPS = {
    "corridor": ("York University", "Sheppard-Yonge"),
    "york-u-finch-west": ("York University", "Finch West"),
    "north-york-centre-sheppard-yonge": ("North York Centre", "Sheppard-Yonge"),
}
MAX_OVERLAP = 0.8


def bearing(a, b) -> float:
    return float(np.degrees(np.arctan2(b[0] - a[0], b[1] - a[1]))) % 360


def turn(prev: float, nxt: float) -> str:
    d = (nxt - prev + 540) % 360 - 180
    if abs(d) < 20:
        return "continue"
    if abs(d) < 45:
        return "slight_right" if d > 0 else "slight_left"
    return "turn_right" if d > 0 else "turn_left"


def path_pieces(g: nx.Graph, path: list) -> list[tuple[int, list]]:
    """Group consecutive path nodes by the piece their edge belongs to."""
    runs: list[tuple[int, list]] = []
    for a, b in zip(path, path[1:], strict=False):
        piece = g.edges[a, b]["piece"]
        if runs and runs[-1][0] == piece:
            runs[-1][1].append(b)
        else:
            runs.append((piece, [a, b]))
    return runs


def alternatives(gr: graphmod.Graph, src, dst) -> list[list]:
    pieces = gr.pieces
    state = {
        idx: segment_state({"id": idx, "evidence": ev}, DEFAULT_PREFS, [])
        for idx, ev in zip(pieces.index, pieces.evidence, strict=True)
    }
    for _, _, d in gr.g.edges(data=True):
        d["w_state"] = d["length"] * STATE_WEIGHT[state[d["piece"]]]
        d["w_len"] = d["length"]
        d["w_alt"] = d["w_state"]

    def run(weight):
        return nx.shortest_path(gr.g, src, dst, weight=weight)

    def piece_len(path):
        out: dict[int, float] = {}
        for a, b in zip(path, path[1:], strict=False):
            e = gr.g.edges[a, b]
            out[e["piece"]] = out.get(e["piece"], 0) + e["length"]
        return out

    def overlap(p, q):
        lp, lq = piece_len(p), piece_len(q)
        shared = sum(min(v, lq.get(k, 0)) for k, v in lp.items())
        return shared / min(sum(lp.values()), sum(lq.values()))

    found = [run("w_state")]
    shortest = run("w_len")
    if overlap(shortest, found[0]) < MAX_OVERLAP:
        found.append(shortest)
    penalty = 2.0
    while len(found) < 3 and penalty <= 64:
        used = set()
        for p in found:
            used |= set(piece_len(p))
        for _, _, d in gr.g.edges(data=True):
            d["w_alt"] = d["w_state"] * (penalty if d["piece"] in used else 1)
        candidate = run("w_alt")
        if all(overlap(candidate, p) < MAX_OVERLAP for p in found):
            found.append(candidate)
        penalty *= 2
    return found


def to_route(gr: graphmod.Graph, path: list, route_id: str) -> dict:
    pieces = gr.pieces
    coords_m = [np.array(n) for n in path]
    lon, lat = gr.to_wgs84.transform([c[0] for c in coords_m], [c[1] for c in coords_m])
    geometry = [[round(x, 6), round(y, 6)] for x, y in zip(lon, lat, strict=True)]

    segments, idx = [], 0
    for n, (piece, nodes_) in enumerate(path_pieces(gr.g, path)):
        row = pieces.loc[piece]
        length = sum(gr.g.edges[a, b]["length"] for a, b in zip(nodes_, nodes_[1:], strict=False))
        segments.append(
            {
                "id": f"{route_id}-{n}-{row.piece_id}",
                "from": idx,
                "to": idx + len(nodes_) - 1,
                "lengthM": round(length, 1),
                "kind": row.kind,
                "streetName": row.street if isinstance(row.street, str) else None,
                "state": "unknown",
                "evidence": row.evidence,
                "_piece": piece,
            }
        )
        idx += len(nodes_) - 1

    hazards = []
    for seg in segments:
        row = pieces.loc[seg["_piece"]]
        s23, s15 = row.slope_2023, row.slope_2015
        if np.isfinite(s23) and np.isfinite(s15) and min(s23, s15) >= 15:
            mid = geometry[(seg["from"] + seg["to"]) // 2]
            hazards.append(
                {
                    "id": f"steep-{row.piece_id}",
                    "kind": "steep_change",
                    "status": "verified",
                    "location": mid,
                    "source": "nrcan-hrdem-2023",
                    "observedOn": "2023-05-11",
                    "expiresAt": None,
                    "segmentId": seg["id"],
                }
            )
    distance = sum(s["lengthM"] for s in segments)
    return {
        "id": route_id,
        "geometry": geometry,
        "distanceM": round(distance, 1),
        "durationS": round(distance / WALK_SPEED_MPS),
        "segments": segments,
        "hazards": hazards,
        "_coords_m": coords_m,
    }


def build_steps(route: dict) -> list[dict]:
    segs = route["segments"]
    coords = route["_coords_m"]
    groups: list[list[dict]] = []
    for s in segs:
        key = ("crossing" if s["kind"] == "crossing" else "walk", s["streetName"])
        if groups and (groups[-1][0]["kind"] == "crossing") == (key[0] == "crossing") and (
            groups[-1][0]["streetName"] == s["streetName"]
        ):
            groups[-1].append(s)
        else:
            groups.append([s])
    steps = []
    prev_bearing = None
    for i, grp in enumerate(groups):
        start, end = grp[0]["from"], grp[-1]["to"]
        first_bearing = bearing(coords[start], coords[min(start + 1, len(coords) - 1)])
        if i == 0:
            maneuver = "depart"
        elif grp[0]["kind"] == "crossing":
            maneuver = "cross"
        else:
            maneuver = turn(prev_bearing, first_bearing)
        prev_bearing = bearing(coords[max(end - 1, 0)], coords[end])
        notes: list[str] = []
        evidence = [e for s in grp for e in s["evidence"]]
        for e in evidence:
            if e["attribute"] == "aps" and e["value"] is True and "aps_present" not in notes:
                notes.append("aps_present")
            if e["attribute"] == "kerbs":
                v = e["value"]
                note = (
                    "kerbs_unknown" if not v or ";" not in v
                    else "kerb_raised" if "raised" in v
                    else "kerbs_lowered" if all(k in ("lowered", "flush", "no") for k in v.split(";"))
                    else "kerbs_unknown"
                )
                if note not in notes:
                    notes.append(note)
            if e["attribute"] == "steps" and "steps" not in notes:
                notes.append("steps")
        if any(e["attribute"] == "surface" and e["value"] is None for e in evidence):
            notes.append("surface_unknown")
        if any(s["state"] == "barrier" for s in grp) and any(
            e["attribute"] == "running_slope"
            and isinstance(e["value"], float | int)
            and e["value"] > DEFAULT_PREFS["maxRunningSlopePct"]
            for e in evidence
        ):
            notes.append("slope_steep")
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
        {"maneuver": "arrive", "streetName": None, "distanceM": 0, "segmentIds": [],
         "at": len(coords) - 1, "notes": []}
    )
    return steps


def finalize(routes: list[dict]) -> list[dict]:
    ranked = {s.id: s for s in rank_routes(routes, DEFAULT_PREFS)}
    out = []
    for r in routes:
        s = ranked[r["id"]]
        for seg in r["segments"]:
            seg["state"] = s.states[seg["id"]]
        dates = [e["observedOn"] for seg in r["segments"] for e in seg["evidence"] if e["observedOn"]]
        r.update(
            steps=build_steps(r),
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
        for seg in r["segments"]:
            seg.pop("_piece")
        r.pop("_coords_m")
        out.append(r)
    return sorted(out, key=lambda r: r["rank"])


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ways, nodes = osm.load(RAW / "osm" / "north_york.osm.pbf")
    ways, nodes = ways.to_crs(METRIC), nodes.to_crs(METRIC)
    stations = nodes[nodes.railway.eq("station")].drop_duplicates("name").set_index("name")
    replication = (RAW / "osm" / "ontario-latest.osm.pbf").stat().st_mtime
    data_version = f"osm-{datetime.fromtimestamp(replication, UTC).date()}+toronto-2026-10-31+hrdem-2023"
    corridor_line, _ = corridor(ways, nodes)
    assert set(CORRIDOR_STATIONS) <= set(stations.index)

    for trip, (a, b) in TRIPS.items():
        pa, pb = stations.loc[a].geometry, stations.loc[b].geometry
        if trip == "corridor":
            area_m = corridor_line.buffer(400)
        else:
            area_m = LineString([pa, pb]).buffer(600)
        area = gpd.GeoSeries([area_m], crs=METRIC).to_crs(4326).iloc[0]
        gr = graphmod.build(area, ways, nodes)
        oa, ob = gpd.GeoSeries(MultiPoint([pa, pb]).geoms, crs=METRIC).to_crs(4326)
        src = graphmod.nearest_node(gr, oa.x, oa.y)
        dst = graphmod.nearest_node(gr, ob.x, ob.y)
        paths = alternatives(gr, src, dst)
        routes = finalize([to_route(gr, p, f"{trip}-{chr(97 + i)}") for i, p in enumerate(paths)])
        doc = {
            "trip": {
                "id": trip,
                "origin": [round(oa.x, 6), round(oa.y, 6)],
                "destination": [round(ob.x, 6), round(ob.y, 6)],
                "originName": a,
                "destinationName": b,
            },
            "preferences": DEFAULT_PREFS,
            "response": {
                "source": "development-fixture",
                "dataVersion": data_version,
                "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
                "routes": routes,
            },
        }
        path = OUT / f"{trip}.json"
        path.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
        summary = [
            (r["id"], r["rank"], r["distanceM"], r["compatibility"],
             {k: round(v / r["distanceM"] * 100) for k, v in r["lengthByState"].items()})
            for r in routes
        ]
        print(trip, f"{path.stat().st_size / 1024:.0f} KB", summary)


if __name__ == "__main__":
    main()
