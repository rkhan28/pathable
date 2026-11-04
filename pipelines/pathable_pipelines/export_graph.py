"""Export the evidence graph as rows for PostGIS, and load it.

Usage:
  uv run python -m pathable_pipelines.export_graph --area corridor --out graph.json
  uv run python -m pathable_pipelines.export_graph --area corridor --load $DATABASE_URL

The same rows feed the API's integration tests (a small real slice is kept in
contracts/fixtures/graph-york-u-finch-west.json) and the routing fixtures.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import numpy as np
from pathable_api.routing import Piece
from shapely.geometry import LineString

from . import graph as graphmod
from . import osm
from .reality_check import METRIC, RAW, corridor

STEEP_HAZARD_PCT = 15.0


def stations(nodes) -> dict:
    st = nodes[nodes.railway.eq("station")].drop_duplicates("name").set_index("name")
    return {name: st.loc[name].geometry for name in st.index}


def area_for(name: str, ways, nodes):
    s = stations(nodes)
    if name == "corridor":
        line, _ = corridor(ways, nodes)
        return line.buffer(400)
    if name == "york-u-finch-west":
        return LineString([s["York University"], s["Finch West"]]).buffer(600)
    if name == "north-york":
        b = gpd.read_file(RAW / "toronto" / "boundary.gpkg").to_crs(METRIC)
        return b.loc[b.AREA_NAME == "NORTH YORK", "geometry"].iloc[0]
    if name == "north-york-centre-sheppard-yonge":
        return LineString([s["North York Centre"], s["Sheppard-Yonge"]]).buffer(600)
    raise ValueError(name)


def export(area_metric, ways, nodes, version: str) -> dict:
    area = gpd.GeoSeries([area_metric], crs=METRIC).to_crs(4326).iloc[0]
    gr = graphmod.build(area, ways, nodes)
    p = gr.pieces.copy()
    p["n"] = p.groupby("way_index").cumcount()
    p["edge_id"] = [f"w{int(o)}-{int(n)}" for o, n in zip(p.osm_id, p.n, strict=True)]
    wgs = p.to_crs(4326)
    edges, hazards = [], []
    for row, geom in zip(p.itertuples(), wgs.geometry, strict=True):
        coords = [[round(x, 7), round(y, 7)] for x, y in geom.coords]
        edges.append(
            {
                "id": row.edge_id,
                "osm_way": int(row.osm_id),
                "kind": row.kind,
                "street": row.street if isinstance(row.street, str) else None,
                "length_m": round(float(row.length_m), 2),
                "evidence": row.evidence,
                "wkt": "LINESTRING(" + ", ".join(f"{x} {y}" for x, y in coords) + ")",
                "coords": coords,
            }
        )
        s23, s15 = row.slope_2023, row.slope_2015
        if np.isfinite(s23) and np.isfinite(s15) and min(s23, s15) >= STEEP_HAZARD_PCT:
            mid = coords[len(coords) // 2]
            hazards.append(
                {
                    "id": f"steep-{row.edge_id}",
                    "kind": "steep_change",
                    "status": "verified",
                    "source": "nrcan-hrdem-2023",
                    "observedOn": "2023-05-11",
                    "expiresAt": None,
                    "edge_id": row.edge_id,
                    "location": mid,
                }
            )
    # Coverage is where the graph exists, plus 30 m so edge endpoints on the boundary are inside it.
    coverage = gpd.GeoSeries([area_metric.buffer(30)], crs=METRIC).to_crs(4326).iloc[0]
    return {"version": version, "coverage_wkt": coverage.wkt, "edges": edges, "hazards": hazards}


def pieces(doc: dict) -> list[Piece]:
    by_edge: dict[str, list[dict]] = {}
    for h in doc["hazards"]:
        by_edge.setdefault(h["edge_id"], []).append(
            {k: v for k, v in h.items() if k != "edge_id"} | {"segmentId": None}
        )
    return [
        Piece(
            e["id"],
            e["kind"],
            e["street"],
            tuple(tuple(c) for c in e["coords"]),
            tuple(e["evidence"]),
            tuple(by_edge.get(e["id"], ())),
        )
        for e in doc["edges"]
    ]


def data_version(area: str) -> str:
    """Name a build after its inputs, so the same inputs always give the same version.

    The date is the OpenStreetMap extract's; the suffix fingerprints every
    downloaded source (name, size, modification time). Re-running on unchanged
    data replaces that version in place; a new download of any source makes a
    new version, and the API serves the newest.
    """
    files = sorted(p for p in RAW.rglob("*") if p.is_file() and p.suffix != ".md5")
    digest = hashlib.sha256()
    for f in files:
        st = f.stat()
        digest.update(f"{f.relative_to(RAW)}:{st.st_size}:{int(st.st_mtime)}\n".encode())
    extract = RAW / "osm" / "ontario-latest.osm.pbf"
    osm_date = datetime.fromtimestamp(extract.stat().st_mtime, UTC).date()
    return f"{area}-{osm_date}-{digest.hexdigest()[:8]}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--area", default="corridor")
    ap.add_argument("--version", default=None)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--load", help="DATABASE_URL to load into")
    args = ap.parse_args()
    ways, nodes = osm.load(RAW / "osm" / "north_york.osm.pbf")
    ways, nodes = ways.to_crs(METRIC), nodes.to_crs(METRIC)
    doc = export(
        area_for(args.area, ways, nodes), ways, nodes, args.version or data_version(args.area)
    )
    print(f"{args.area}: {len(doc['edges'])} edges, {len(doc['hazards'])} hazards")
    if args.out:
        args.out.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    if args.load:
        from pathable_api.db import load_graph

        load_graph(
            args.load,
            doc["version"],
            doc["coverage_wkt"],
            doc["edges"],
            doc["hazards"],
            notes=f"area={args.area}",
        )
        print("loaded", doc["version"])


if __name__ == "__main__":
    main()
