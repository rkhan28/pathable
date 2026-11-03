"""Read pedestrian-relevant OpenStreetMap objects from a clipped extract."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import osmium
import pandas as pd
from shapely import wkb

PEDESTRIAN_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "living_street", "cycleway"}
ROAD_HIGHWAYS = {
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "service",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "trunk",
    "trunk_link",
}
WAY_TAGS = (
    "highway",
    "footway",
    "sidewalk",
    "sidewalk:left",
    "sidewalk:right",
    "sidewalk:both",
    "surface",
    "smoothness",
    "width",
    "incline",
    "wheelchair",
    "tactile_paving",
    "kerb",
    "crossing",
    "foot",
    "access",
    "name",
    "bridge",
    "tunnel",
    "level",
    "indoor",
    "check_date",
)
NODE_KEYS = ("kerb", "highway", "barrier", "tactile_paving", "wheelchair", "crossing", "railway")
NODE_TAGS = (*NODE_KEYS, "name", "public_transport", "crossing:signals", "traffic_signals:sound")

_wkb = osmium.geom.WKBFactory()


class _Collector(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.ways: list[dict] = []
        self.nodes: list[dict] = []

    def node(self, n: osmium.osm.Node) -> None:
        if not any(k in n.tags for k in NODE_KEYS):
            return
        row = {t: n.tags.get(t) for t in NODE_TAGS}
        row.update(
            osm_id=n.id,
            version=n.version,
            timestamp=n.timestamp,
            geometry=wkb.loads(_wkb.create_point(n)),
        )
        self.nodes.append(row)

    def way(self, w: osmium.osm.Way) -> None:
        hw = w.tags.get("highway")
        if hw not in PEDESTRIAN_HIGHWAYS and hw not in ROAD_HIGHWAYS:
            return
        try:
            geom = wkb.loads(_wkb.create_linestring(w))
        except osmium.InvalidLocationError:
            return
        row = {t: w.tags.get(t) for t in WAY_TAGS}
        row.update(
            osm_id=w.id,
            version=w.version,
            timestamp=w.timestamp,
            node_ids=[n.ref for n in w.nodes],
            geometry=geom,
        )
        self.ways.append(row)


def load(pbf: Path) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """Return (ways, nodes) in EPSG:4326 with the tags PathAble reads."""
    handler = _Collector()
    handler.apply_file(str(pbf), locations=True)
    ways = gpd.GeoDataFrame(handler.ways, geometry="geometry", crs=4326)
    nodes = gpd.GeoDataFrame(handler.nodes, geometry="geometry", crs=4326)
    for df in (ways, nodes):
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return ways, nodes
