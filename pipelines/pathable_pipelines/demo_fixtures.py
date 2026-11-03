"""Compute the development fixtures from the real North York graph.

Usage: uv run python -m pathable_pipelines.demo_fixtures

Routes come from the API's own router (pathable_api.routing.EvidenceGraph)
over the exported evidence graph, so a fixture is exactly what the live API
returns for the same data. They are labelled ``development-fixture`` because
they are a frozen snapshot served without the API.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
from pathable_api.routing import EvidenceGraph

from . import osm
from .export_graph import area_for, export, pieces, stations
from .reality_check import METRIC, RAW

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "contracts" / "fixtures" / "routes"
DEFAULT_PREFS = json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text())
TRIPS = {
    "corridor": ("York University", "Sheppard-Yonge"),
    "york-u-finch-west": ("York University", "Finch West"),
    "north-york-centre-sheppard-yonge": ("North York Centre", "Sheppard-Yonge"),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ways, nodes = osm.load(RAW / "osm" / "north_york.osm.pbf")
    ways, nodes = ways.to_crs(METRIC), nodes.to_crs(METRIC)
    st = stations(nodes)
    replication = (RAW / "osm" / "ontario-latest.osm.pbf").stat().st_mtime
    data_version = (
        f"osm-{datetime.fromtimestamp(replication, UTC).date()}+toronto-2026-10-31+hrdem-2023"
    )

    for trip, (a, b) in TRIPS.items():
        doc = export(area_for(trip, ways, nodes), ways, nodes, data_version)
        ends = gpd.GeoSeries([st[a], st[b]], crs=METRIC).to_crs(4326)
        origin = (round(ends.iloc[0].x, 6), round(ends.iloc[0].y, 6))
        destination = (round(ends.iloc[1].x, 6), round(ends.iloc[1].y, 6))
        routes = EvidenceGraph(pieces(doc)).route(origin, destination, DEFAULT_PREFS)
        for r in routes:  # stable, readable ids: corridor-a, corridor-b, ...
            old = r["id"]
            r["id"] = f"{trip}-{old[-1]}"
            for seg in r["segments"]:
                seg["id"] = seg["id"].replace(old, r["id"], 1)
            for h in r["hazards"]:
                h["segmentId"] = h["segmentId"].replace(old, r["id"], 1)
            for step in r["steps"]:
                step["segmentIds"] = [s.replace(old, r["id"], 1) for s in step["segmentIds"]]
        out = {
            "trip": {
                "id": trip,
                "origin": list(origin),
                "destination": list(destination),
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
        path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
        summary = [(r["id"], r["rank"], r["distanceM"], r["compatibility"]) for r in routes]
        print(trip, f"{path.stat().st_size / 1024:.0f} KB", summary)


if __name__ == "__main__":
    main()
