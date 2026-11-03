"""Build a routable pedestrian graph whose edges carry per-attribute evidence.

Each OSM way is cut into pieces of at most 50 m. Every piece gets the evidence
rows defined by the API contract (surface, width, running slope, kerbs, steps,
accessible pedestrian signals), each with its source, observation date and
measured error. Graph nodes are keyed by projected coordinates so ways that
share an OSM node connect.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer

from . import measure, osm
from .reality_check import (
    DTM_2015,
    DTM_2023,
    METRIC,
    PED_HIGHWAYS,
    PROFILE_STEP_M,
    RAW,
    SEGMENT_MAX_M,
    SLOPE_STEP_M,
    crossing_kerbs_raw,
    read_dtm,
    segment,
)

# Measured in docs/DATA_REPORT.md; carried on every evidence row.
WIDTH_ERROR_M = 0.12
SLOPE_ERROR_PP = 0.17
DTM_DATES = {"nrcan-hrdem-2023": "2023-05-11", "nrcan-hrdem-2015": "2015-04-25"}
ROAD_EDGE_HIGHWAYS = {"residential", "service", "unclassified", "tertiary", "living_street"}
APS_RADIUS_M = 30


@dataclass
class Graph:
    g: nx.Graph
    pieces: gpd.GeoDataFrame
    to_wgs84: Transformer


def node_key(x: float, y: float) -> tuple[float, float]:
    return (round(x, 2), round(y, 2))


def walkable_ways(ways: gpd.GeoDataFrame, area) -> gpd.GeoDataFrame:
    """Pedestrian ways, plus minor roads that have no separately mapped sidewalk."""
    ped = ways.highway.isin(PED_HIGHWAYS)
    separate = (
        ways.sidewalk.eq("separate")
        | ways["sidewalk:both"].eq("separate")
        | ways["sidewalk:left"].eq("separate")
        | ways["sidewalk:right"].eq("separate")
    )
    road = ways.highway.isin(ROAD_EDGE_HIGHWAYS) & ~separate & ~ways.access.isin(["private", "no"])
    keep = ways[(ped | road) & ~ways.foot.isin(["no", "private"]) & ways.intersects(area)].copy()
    keep["geometry"] = keep.geometry.intersection(area)
    keep = keep[~keep.geometry.is_empty & keep.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    keep["length_m"] = keep.length
    return keep


def piece_kind(row) -> str:
    if row.highway == "steps":
        return "steps"
    if row.footway == "crossing":
        return "crossing"
    if row.footway == "sidewalk":
        return "sidewalk"
    if row.highway in PED_HIGHWAYS:
        return "path"
    return "road_edge"


def date_of(ts) -> str | None:
    return None if pd.isna(ts) else pd.Timestamp(ts).date().isoformat()


def widths_with_dates(pieces: gpd.GeoDataFrame, polygons: gpd.GeoDataFrame) -> pd.DataFrame:
    """Median transect width and the polygon maintenance date for each sidewalk piece."""
    geoms = polygons.geometry.values
    dates = pd.to_datetime(polygons.LAST_GEOMETRY_MAINT, errors="coerce").values
    tree = shapely.STRtree(geoms)
    rows = {}
    for idx, geom in zip(pieces.index, pieces.geometry, strict=True):
        if geom.length < 2:
            continue
        pts, lines = measure.transects(geom, step=10, half_length=6)
        widths, hit_dates = [], []
        for p, t in zip(pts, lines, strict=True):
            cand = tree.query(t)
            if len(cand) == 0:
                continue
            w = measure.width_at(p, t, shapely.union_all(geoms[cand]))
            if w is not None:
                widths.append(w)
                hit_dates.extend(dates[cand])
        if widths and len(widths) / len(pts) >= 0.5:
            observed = pd.Series(hit_dates).dropna()
            rows[idx] = {
                "width_median": float(np.median(widths)),
                "width_observed": observed.max().date().isoformat() if len(observed) else None,
            }
    return pd.DataFrame.from_dict(rows, orient="index")


def slopes(pieces: gpd.GeoDataFrame, area) -> pd.DataFrame:
    to_3979 = Transformer.from_crs(METRIC, 3979, always_xy=True)
    minx, miny, maxx, maxy = area.bounds
    xs, ys = to_3979.transform([minx, maxx, minx, maxx], [miny, miny, maxy, maxy])
    bounds = (min(xs) - 20, min(ys) - 20, max(xs) + 20, max(ys) + 20)
    dtms = {"2023": read_dtm(DTM_2023, bounds), "2015": read_dtm(DTM_2015, bounds)}
    rows = {}
    for idx, row in pieces.iterrows():
        geom = row.geometry
        flagged = any(
            isinstance(v, str) and v not in ("no", "0")
            for v in (row.bridge, row.tunnel, row.indoor, row.level)
        )
        if flagged or row.highway == "steps" or geom.length < SLOPE_STEP_M + PROFILE_STEP_M:
            continue
        pts = measure.split_line(geom, PROFILE_STEP_M)
        x, y = to_3979.transform(pts[:, 0], pts[:, 1])
        spacing = geom.length / (len(pts) - 1)
        rec = {}
        for name, (grid, transform, nodata) in dtms.items():
            z = measure.bilinear(grid, transform, np.asarray(x), np.asarray(y), nodata)
            s = measure.window_slopes(z, spacing, SLOPE_STEP_M)
            rec[f"slope_{name}"] = float(np.nanmax(s)) if np.isfinite(s).any() else np.nan
        rows[idx] = rec
    return pd.DataFrame.from_dict(rows, orient="index")


def aps_near(pieces: gpd.GeoDataFrame, signals: gpd.GeoDataFrame) -> pd.Series:
    """True/None per crossing piece: an APS-equipped City signal within 30 m."""
    crossings = pieces[pieces.kind == "crossing"]
    if crossings.empty:
        return pd.Series(dtype=object)
    joined = gpd.sjoin_nearest(
        crossings[["geometry"]], signals[["geometry", "AUDIBLEPEDSIGNAL"]],
        max_distance=APS_RADIUS_M, how="left",
    )
    joined = joined[~joined.index.duplicated()]
    return joined.AUDIBLEPEDSIGNAL.map(lambda v: True if v == 1 else None)


def street_names(pieces: gpd.GeoDataFrame, ways: gpd.GeoDataFrame) -> pd.Series:
    """Name of the way itself, else the nearest named road within 25 m."""
    named = ways[ways.name.notna() & ~ways.highway.isin(PED_HIGHWAYS)][["geometry", "name"]]
    mids = gpd.GeoDataFrame(
        geometry=pieces.geometry.interpolate(0.5, normalized=True), index=pieces.index, crs=METRIC
    )
    near = gpd.sjoin_nearest(mids, named, max_distance=25, how="left")
    near = near[~near.index.duplicated()]
    return pieces.name.where(pieces.name.notna(), near.name)


def evidence_for(row) -> list[dict]:
    when = date_of(row.timestamp)
    rows: list[dict] = []
    if row.kind == "steps":
        rows.append({"attribute": "steps", "value": True, "source": "osm", "observedOn": when})
    if row.kind == "road_edge":
        sides = row.sidewalk
        present = None if not isinstance(sides, str) else sides in ("both", "left", "right", "yes")
        rows.append(
            {"attribute": "presence", "value": present,
             "source": "osm" if present is not None else None,
             "observedOn": when if present is not None else None}
        )
    surface = row.surface if isinstance(row.surface, str) else None
    rows.append(
        {"attribute": "surface", "value": surface, "source": "osm" if surface else None,
         "observedOn": when if surface else None}
    )
    if row.kind == "sidewalk":
        w = row.width_median
        has = isinstance(w, float) and np.isfinite(w)
        rows.append(
            {"attribute": "width", "value": round(w, 2) if has else None, "unit": "m",
             "error": WIDTH_ERROR_M, "source": "toronto-sidewalk-polygons" if has else None,
             "observedOn": row.width_observed if has else None}
        )
    elif row.kind in ("path", "road_edge"):
        # Width applies here too; without a mapped value it is no data, never skipped.
        tagged = measure.parse_width_m(row.width)
        rows.append(
            {"attribute": "width", "value": tagged, "unit": "m", "error": 0.0,
             "source": "osm" if tagged else None, "observedOn": when if tagged else None}
        )
    if row.kind != "steps":
        s23, s15 = row.slope_2023, row.slope_2015
        has23 = isinstance(s23, float) and np.isfinite(s23)
        ev = {"attribute": "running_slope", "value": round(s23, 1) if has23 else None,
              "unit": "pct", "error": SLOPE_ERROR_PP,
              "source": "nrcan-hrdem-2023" if has23 else None,
              "observedOn": DTM_DATES["nrcan-hrdem-2023"] if has23 else None}
        if has23 and isinstance(s15, float) and np.isfinite(s15):
            ev["corroboration"] = {"value": round(s15, 1), "source": "nrcan-hrdem-2015",
                                   "observedOn": DTM_DATES["nrcan-hrdem-2015"]}
        rows.append(ev)
    if row.kind == "crossing":
        kerbs = row.kerb_value if isinstance(row.kerb_value, str) else None
        rows.append(
            {"attribute": "kerbs", "value": kerbs, "source": "osm" if kerbs else None,
             "observedOn": when if kerbs else None}
        )
        aps = row.aps if isinstance(row.aps, bool) else None
        rows.append(
            {"attribute": "aps", "value": aps, "source": "toronto-traffic-signals" if aps else None,
             "observedOn": "2026-10-31" if aps else None}
        )
    return rows


def build(area_wgs84, ways: gpd.GeoDataFrame | None = None, nodes: gpd.GeoDataFrame | None = None) -> Graph:
    """Build the evidence graph for ``area_wgs84`` (a shapely geometry in EPSG:4326)."""
    if ways is None or nodes is None:
        w, n = osm.load(RAW / "osm" / "north_york.osm.pbf")
        ways, nodes = w.to_crs(METRIC), n.to_crs(METRIC)
    area = gpd.GeoSeries([area_wgs84], crs=4326).to_crs(METRIC).iloc[0]
    walk = walkable_ways(ways, area)
    walk["kerb_value"] = crossing_kerbs_raw(walk, nodes)
    pieces = segment(walk, SEGMENT_MAX_M)
    pieces["kind"] = pieces.apply(piece_kind, axis=1)
    pieces["kerb_value"] = pieces.way_index.map(walk.kerb_value)

    poly = gpd.read_file(RAW / "toronto" / "sidewalk_polygons.gpkg", bbox=tuple(area_wgs84.bounds))
    poly = poly.to_crs(METRIC).explode(index_parts=False)
    pieces = pieces.join(widths_with_dates(pieces[pieces.kind == "sidewalk"], poly))
    pieces = pieces.join(slopes(pieces, area))
    for col in ("width_median", "width_observed", "slope_2023", "slope_2015"):
        if col not in pieces:
            pieces[col] = np.nan
    signals = gpd.read_file(RAW / "toronto" / "traffic_signals.gpkg").to_crs(METRIC)
    pieces["aps"] = aps_near(pieces, signals).reindex(pieces.index)
    pieces["street"] = street_names(pieces, ways)
    pieces["evidence"] = pieces.apply(evidence_for, axis=1)
    pieces["piece_id"] = [f"w{r.osm_id}-{i}" for i, r in enumerate(pieces.itertuples())]

    g = nx.Graph()
    for idx, geom in zip(pieces.index, pieces.geometry, strict=True):
        coords = list(geom.coords)
        for a, b in zip(coords, coords[1:], strict=False):
            ka, kb = node_key(*a), node_key(*b)
            if ka == kb:
                continue
            g.add_edge(ka, kb, piece=idx, length=float(np.hypot(b[0] - a[0], b[1] - a[1])))
    return Graph(g, pieces, Transformer.from_crs(METRIC, 4326, always_xy=True))


def nearest_node(graph: Graph, lon: float, lat: float) -> tuple[float, float]:
    x, y = Transformer.from_crs(4326, METRIC, always_xy=True).transform(lon, lat)
    keys = np.array(list(graph.g.nodes))
    i = np.argmin(np.hypot(keys[:, 0] - x, keys[:, 1] - y))
    return tuple(keys[i])


def save(graph: Graph, path: Path) -> None:
    graph.pieces.drop(columns=["node_ids"], errors="ignore").to_parquet(path)
