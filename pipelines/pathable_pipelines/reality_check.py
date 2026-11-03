"""Milestone 0: measure what is actually known about North York sidewalks.

Usage: uv run python -m pathable_pipelines.reality_check

Reads the files written by ``fetch`` plus the clipped OSM extract and the
lidar terrain models, and writes ``docs/data/reality_check.json`` and the
PNG maps referenced by docs/DATA_REPORT.md. Every number in that report is
read from the JSON this module writes.
"""

from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import itertools

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import pandas as pd
import rasterio
import shapely
from pyproj import Transformer
from rasterio.windows import from_bounds
from shapely.geometry import LineString
from shapely.ops import substring

from . import measure, osm

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "docs" / "data"
METRIC = 2952  # NAD83(CSRS) / MTM zone 10, the City of Toronto's working CRS
DTM_2023 = "/vsicurl/https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/TRCA-GTA_2023-1m-dtm.tif"
DTM_2015 = "/vsicurl/https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/NRCAN-GTA2015-1m-dtm.tif"

# Demo corridor anchors, taken from OSM station nodes so they are not hand-typed.
CORRIDOR_STATIONS = ("York University", "Finch West", "Sheppard-Yonge")
CORRIDOR_HALF_WIDTH_M = 250

# Baseline profile used only to estimate knowledge-state shares in this report.
# The product never applies one profile to everyone; these are the Ontario
# Integrated Accessibility Standards (O. Reg. 191/11, s. 80.23) exterior path
# defaults that preferences start from.
BASELINE_MAX_RUNNING_SLOPE_PCT = 5.0
BASELINE_MIN_WIDTH_M = 1.5
SLOPE_STEP_M = 10.0  # running slope is measured over 10 m windows
SEGMENT_MAX_M = 50.0  # graph edge length cap used for every corridor measurement
PROFILE_STEP_M = 2.0  # elevation profile spacing before smoothing
WIDTH_SENSITIVITY_M = (0.9, 1.2, 1.5)

PED_HIGHWAYS = {"footway", "path", "pedestrian", "steps", "living_street"}
GOOD_KERBS = {"lowered", "flush", "no"}

STATE_STYLE = {
    # colour, line style; matches the product's encoding (colour + pattern).
    "known_accessible": ("#13A06B", "-"),
    "known_barrier": ("#C8372D", "-"),
    "reported_unverified": ("#C77700", "--"),
    "no_data": ("#7A807C", ":"),
}


@dataclass
class Context:
    ny: gpd.GeoSeries
    neighbourhoods: gpd.GeoDataFrame
    ways: gpd.GeoDataFrame
    nodes: gpd.GeoDataFrame


def pct(part: float, whole: float) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def load_context() -> Context:
    boundary = gpd.read_file(RAW / "toronto" / "boundary.gpkg").to_crs(METRIC)
    ny = boundary.loc[boundary.AREA_NAME == "NORTH YORK", "geometry"]
    nb = gpd.read_file(RAW / "toronto" / "neighbourhoods.gpkg").to_crs(METRIC)
    reps = nb.representative_point()
    nb = nb[reps.within(ny.iloc[0])].copy()
    ways, nodes = osm.load(RAW / "osm" / "north_york.osm.pbf")
    return Context(ny, nb, ways.to_crs(METRIC), nodes.to_crs(METRIC))


def pedestrian_ways(ways: gpd.GeoDataFrame, area) -> gpd.GeoDataFrame:
    ped = ways[ways.highway.isin(PED_HIGHWAYS)]
    ped = ped[~ped.foot.isin(["no", "private"]) & ~ped.access.isin(["no", "private"])]
    ped = ped[ped.intersects(area)].copy()
    ped["geometry"] = ped.geometry.intersection(area)
    ped = ped[~ped.geometry.is_empty]
    ped["length_m"] = ped.length
    return ped


def segment(gdf: gpd.GeoDataFrame, max_len: float) -> gpd.GeoDataFrame:
    """Split ways into pieces of at most ``max_len`` metres, as the routing graph will."""
    rows = []
    for idx, row in gdf.iterrows():
        geoms = (
            [row.geometry] if row.geometry.geom_type == "LineString" else list(row.geometry.geoms)
        )
        for g in geoms:
            n = max(int(np.ceil(g.length / max_len)), 1)
            for i in range(n):
                piece = substring(g, g.length * i / n, g.length * (i + 1) / n)
                rows.append({**row.drop("geometry").to_dict(), "way_index": idx, "geometry": piece})
    out = gpd.GeoDataFrame(rows, geometry="geometry", crs=gdf.crs)
    out["length_m"] = out.length
    return out


def tag_completeness(ped: gpd.GeoDataFrame, kerb_ok: pd.Series) -> dict:
    groups = {
        "all_pedestrian_ways": ped,
        "sidewalks": ped[ped.footway == "sidewalk"],
        "crossings": ped[ped.footway == "crossing"],
    }
    out: dict[str, dict] = {}
    for name, g in groups.items():
        total = g.length_m.sum()
        row = {"count": len(g), "km": round(total / 1000, 1)}
        for tag in ("surface", "smoothness", "width", "incline", "wheelchair", "tactile_paving"):
            row[tag] = pct(g.loc[g[tag].notna(), "length_m"].sum(), total)
        if name == "crossings":
            known = kerb_ok.reindex(g.index)
            row["kerb_both_ends_known"] = pct((known != "unknown").sum(), len(g))
        out[name] = row
    return out


def crossing_kerbs_raw(ways: gpd.GeoDataFrame, nodes: gpd.GeoDataFrame) -> pd.Series:
    """Per way: "start;end" kerb values for crossings, a single value if only one
    end is mapped, None otherwise. Values are OSM ``kerb`` tags, unchanged."""
    kerb_by_node = nodes.dropna(subset=["kerb"]).set_index("osm_id")["kerb"].to_dict()
    out: dict = {}
    for idx, row in ways.iterrows():
        if row.footway != "crossing":
            out[idx] = None
        elif isinstance(row.kerb, str):
            out[idx] = f"{row.kerb};{row.kerb}"
        else:
            kerbs = [kerb_by_node[n] for n in row.node_ids if n in kerb_by_node]
            out[idx] = f"{kerbs[0]};{kerbs[-1]}" if len(kerbs) >= 2 else (kerbs[0] if kerbs else None)
    return pd.Series(out, dtype="object")


def crossing_kerbs(ped: gpd.GeoDataFrame, nodes: gpd.GeoDataFrame) -> pd.Series:
    """Per crossing way: pass / fail / unknown for kerbs at both ends."""
    kerb_by_node = nodes.dropna(subset=["kerb"]).set_index("osm_id")["kerb"].to_dict()
    result = {}
    for idx, row in ped[ped.footway == "crossing"].iterrows():
        if row.kerb:
            kerbs = [row.kerb, row.kerb]
        else:
            kerbs = [kerb_by_node[n] for n in row.node_ids if n in kerb_by_node]
        if len(kerbs) < 2:
            result[idx] = "fail" if any(k == "raised" for k in kerbs) else "unknown"
        elif all(k in GOOD_KERBS for k in kerbs):
            result[idx] = "pass"
        elif any(k == "raised" for k in kerbs):
            result[idx] = "fail"
        else:
            result[idx] = "unknown"
    return pd.Series(result, dtype="object")


def osm_sidewalk_km(ways: gpd.GeoDataFrame, area) -> float:
    """Sidewalk length represented in OSM: separate geometry plus road sidewalk tags."""
    sep = ways[(ways.footway == "sidewalk") & ways.intersects(area)]
    sep_km = sep.geometry.intersection(area).length.sum() / 1000
    roads = ways[~ways.highway.isin(PED_HIGHWAYS) & ways.intersects(area)]
    sides = roads.sidewalk.map({"both": 2, "left": 1, "right": 1}).fillna(0)
    sides += roads["sidewalk:both"].map({"yes": 2}).fillna(0)
    sides += roads["sidewalk:left"].map({"yes": 1}).fillna(0)
    sides += roads["sidewalk:right"].map({"yes": 1}).fillna(0)
    tag_km = (roads.geometry.intersection(area).length * sides.clip(upper=2)).sum() / 1000
    return sep_km + tag_km


def city_inventory(area) -> gpd.GeoDataFrame:
    zpath = RAW / "toronto" / "sidewalk_inventory.zip"
    shp = next(n for n in zipfile.ZipFile(zpath).namelist() if n.endswith(".shp"))
    inv = gpd.read_file(f"zip://{zpath}!{shp}").to_crs(METRIC)
    inv = inv[inv.intersects(area)].copy()
    inv["geometry"] = inv.geometry.intersection(area)
    sides = {7: 2, 1: 1, 2: 1, 4: 1, 5: 1}
    inv["sides"] = inv.SDWLK_Code.map(sides).fillna(0)
    inv["sidewalk_km"] = inv.length * inv.sides / 1000
    return inv


def corridor(ways: gpd.GeoDataFrame, nodes: gpd.GeoDataFrame) -> tuple[LineString, object]:
    """Walkable shortest path through the three corridor stations, buffered."""
    graph = nx.Graph()
    walkable = ways[~ways.highway.isin(["trunk", "trunk_link"]) & ~ways.foot.isin(["no"])]
    for geom, node_ids in zip(walkable.geometry, walkable.node_ids, strict=True):
        coords = list(geom.coords)
        if len(coords) != len(node_ids):
            continue
        for (a, ca), (b, cb) in zip(
            zip(node_ids, coords, strict=True),
            zip(node_ids[1:], coords[1:], strict=True),
            strict=False,
        ):
            graph.add_edge(
                a, b, weight=float(np.hypot(cb[0] - ca[0], cb[1] - ca[1])), coords=(ca, cb)
            )
            graph.nodes[a]["xy"] = ca
            graph.nodes[b]["xy"] = cb
    ids = np.array(list(graph.nodes))
    xy = np.array([graph.nodes[i]["xy"] for i in ids])
    stations = nodes[nodes.railway.eq("station") & nodes.name.isin(CORRIDOR_STATIONS)]
    anchors = []
    for name in CORRIDOR_STATIONS:
        p = stations[stations.name == name].geometry.iloc[0]
        anchors.append(ids[np.argmin(np.hypot(xy[:, 0] - p.x, xy[:, 1] - p.y))])
    path: list = []
    for a, b in itertools.pairwise(anchors):
        leg = nx.shortest_path(graph, a, b, weight="weight")
        path.extend(leg if not path else leg[1:])
    line = LineString([graph.nodes[n]["xy"] for n in path])
    return line, line.buffer(CORRIDOR_HALF_WIDTH_M)


def estimate_widths(sidewalks: gpd.GeoDataFrame, polygons: gpd.GeoDataFrame) -> pd.DataFrame:
    """Median and 10th-percentile width per way from 10 m perpendicular transects."""
    tree = shapely.STRtree(polygons.geometry.values)
    rows = []
    for idx, geom in zip(sidewalks.index, sidewalks.geometry, strict=True):
        if geom.geom_type != "LineString" or geom.length < 2:
            continue
        pts, lines = measure.transects(geom, step=10, half_length=6)
        widths = []
        for p, t in zip(pts, lines, strict=True):
            cand = tree.query(t)
            if len(cand) == 0:
                continue
            w = measure.width_at(p, t, shapely.union_all(polygons.geometry.values[cand]))
            if w is not None:
                widths.append(w)
        covered = len(widths) / len(pts)
        rows.append(
            {
                "idx": idx,
                "samples": len(pts),
                "covered": covered,
                "width_median": float(np.median(widths)) if widths and covered >= 0.5 else np.nan,
                "width_p10": float(np.percentile(widths, 10))
                if widths and covered >= 0.5
                else np.nan,
            }
        )
    return pd.DataFrame(rows).set_index("idx")


def read_dtm(url: str, bounds_3979: tuple[float, float, float, float]):
    with rasterio.open(url) as src:
        window = from_bounds(*bounds_3979, transform=src.transform).round_offsets().round_lengths()
        grid = src.read(1, window=window)
        return grid, src.window_transform(window), src.nodata


def way_slopes(ped: gpd.GeoDataFrame, dtms: dict) -> pd.DataFrame:
    """Max 10 m running slope per way, for each terrain model."""
    to_3979 = Transformer.from_crs(METRIC, 3979, always_xy=True)
    rows = []
    for idx, row in ped.iterrows():
        geom = row.geometry

        # A bare-earth terrain model says nothing about bridges, tunnels,
        # indoor or multi-level ways, so those get no slope rather than a wrong one.
        def tagged(value, ignore=("no",)):
            return isinstance(value, str) and value not in ignore

        skip = (
            row.highway == "steps"
            or tagged(row.bridge)
            or tagged(row.tunnel)
            or tagged(row.indoor)
            or tagged(row.level, ignore=("0",))
        )
        if skip or geom.geom_type != "LineString" or geom.length < SLOPE_STEP_M + PROFILE_STEP_M:
            rows.append({"idx": idx, "excluded": bool(skip)})
            continue
        pts = measure.split_line(geom, PROFILE_STEP_M)
        x, y = to_3979.transform(pts[:, 0], pts[:, 1])
        spacing = geom.length / (len(pts) - 1)
        rec = {"idx": idx, "excluded": False}
        for name, (grid, transform, nodata) in dtms.items():
            z = measure.bilinear(grid, transform, np.asarray(x), np.asarray(y), nodata)
            s = measure.window_slopes(z, spacing, SLOPE_STEP_M)
            rec[f"max_slope_{name}"] = float(np.nanmax(s)) if np.isfinite(s).any() else np.nan
        rows.append(rec)
    return pd.DataFrame(rows).set_index("idx")


def corroborated_slope(s2023: float, s2015: float, margin: float) -> str:
    """Slope counts as known only when two independent lidar surveys agree.

    Disagreement usually means the ground changed (construction) or one survey
    hit a wall or stair edge; either way the terrain model cannot be trusted there.
    """
    a = measure.three_way(s2023, BASELINE_MAX_RUNNING_SLOPE_PCT, margin, higher_is_better=False)
    b = measure.three_way(s2015, BASELINE_MAX_RUNNING_SLOPE_PCT, margin, higher_is_better=False)
    return a if a == b else "unknown"


def attribute_checks(row, width_margin: float, slope_margin: float, min_width: float) -> dict:
    """Per-attribute pass / fail / unknown for one way under the baseline profile."""
    checks = {
        "steps": "fail" if row.highway == "steps" else "pass",
        "surface": measure.classify_surface(row.surface),
        "slope": corroborated_slope(row.max_slope_2023, row.max_slope_2015, slope_margin),
    }
    if row.footway == "crossing":
        checks["kerbs"] = row.kerb_state
    else:
        checks["width"] = measure.three_way(
            row.width_median, min_width, width_margin, higher_is_better=True
        )
    return checks


def knowledge_state(checks: dict) -> str:
    """Barrier if anything known fails; accessible only if everything is known to pass."""
    values = checks.values()
    if "fail" in values:
        return "known_barrier"
    if all(v == "pass" for v in values):
        return "known_accessible"
    return "no_data"


def plot_lines(ax, gdf: gpd.GeoDataFrame, column: str) -> None:
    for state, (colour, style) in STATE_STYLE.items():
        part = gdf[gdf[column] == state]
        if len(part):
            part.plot(
                ax=ax, color=colour, linestyle=style, linewidth=1.4, label=state.replace("_", " ")
            )


def style_axes(ax, title: str) -> None:
    ax.set_title(title, loc="left", fontsize=11)
    ax.set_axis_off()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ctx = load_context()
    ny = ctx.ny.iloc[0]
    report: dict = {"area_km2": round(ny.area / 1e6, 1)}
    manifest = json.loads((RAW / "manifest.json").read_text())
    report["sources"] = {
        k: {f: v.get(f) for f in ("title", "licence", "last_refreshed", "resource_name", "sha256")}
        for k, v in manifest.items()
    }

    # OpenStreetMap -----------------------------------------------------------
    ped = pedestrian_ways(ctx.ways, ny)
    kerbs = crossing_kerbs(ped, ctx.nodes)
    report["osm_north_york"] = tag_completeness(ped, kerbs)
    crossings_nodes = ctx.nodes[ctx.nodes.highway.eq("crossing") & ctx.nodes.within(ny)]
    report["osm_crossing_nodes"] = {
        "count": len(crossings_nodes),
        "with_tactile_paving": pct(
            crossings_nodes.tactile_paving.notna().sum(), len(crossings_nodes)
        ),
        "with_kerb_tag": pct(crossings_nodes.kerb.notna().sum(), len(crossings_nodes)),
    }
    kerb_nodes = ctx.nodes[ctx.nodes.kerb.notna() & ctx.nodes.within(ny)]
    report["osm_kerb_nodes"] = kerb_nodes.kerb.value_counts().to_dict()
    report["osm_newest_edit"] = str(ctx.ways.timestamp.max())

    # City sidewalk inventory vs OSM -------------------------------------------
    inv = city_inventory(ny)
    city_km = inv.sidewalk_km.sum()
    osm_km = osm_sidewalk_km(ctx.ways, ny)
    report["sidewalk_presence"] = {
        "city_inventory_sidewalk_km": round(city_km, 1),
        "city_partial_segments_pct": pct((inv.Partial == 1).sum(), (inv.sides > 0).sum()),
        "osm_sidewalk_km": round(osm_km, 1),
        "osm_to_city_ratio_pct": pct(osm_km, city_km),
        "city_no_sidewalk_road_km": round(inv.loc[inv.SDWLK_Code == 3].length.sum() / 1000, 1),
    }
    per_nb = []
    for _, nb in ctx.neighbourhoods.iterrows():
        area = nb.geometry
        c = inv[inv.intersects(area)]
        ckm = (c.geometry.intersection(area).length * c.sides).sum() / 1000
        okm = osm_sidewalk_km(ctx.ways, area)
        per_nb.append(
            {
                "name": nb.AREA_NAME,
                "city_km": ckm,
                "osm_km": okm,
                "ratio": okm / ckm if ckm else np.nan,
            }
        )
    nbdf = pd.DataFrame(per_nb)
    ctx.neighbourhoods["osm_ratio"] = nbdf.ratio.values
    report["neighbourhood_osm_ratio"] = {
        "count": len(nbdf),
        "median_pct": round(float(nbdf.ratio.median()) * 100, 1),
        "min": nbdf.loc[nbdf.ratio.idxmin(), ["name", "ratio"]].to_dict(),
        "max": nbdf.loc[nbdf.ratio.idxmax(), ["name", "ratio"]].to_dict(),
        "below_50pct": int((nbdf.ratio < 0.5).sum()),
    }

    # Signals ------------------------------------------------------------------
    sig = gpd.read_file(RAW / "toronto" / "traffic_signals.gpkg").to_crs(METRIC)
    sig = sig[sig.within(ny)]
    pxo = gpd.read_file(RAW / "toronto" / "pedestrian_crossovers.gpkg").to_crs(METRIC)
    report["signals"] = {
        "traffic_signals": len(sig),
        "aps_pct": pct(sig.AUDIBLEPEDSIGNAL.eq(1).sum(), len(sig)),
        "aps_operation": sig.APS_OPERATION.value_counts().to_dict(),
        "pedestrian_crossovers": int(pxo.within(ny).sum()),
    }

    # Sidewalk polygons and width ---------------------------------------------
    poly = gpd.read_file(RAW / "toronto" / "sidewalk_polygons.gpkg").to_crs(METRIC)
    poly = poly[poly.intersects(ny)].explode(index_parts=False)
    report["sidewalk_polygons"] = {
        "features_in_north_york": len(poly),
        "area_km2": round(poly.area.sum() / 1e6, 2),
        "geometry_maintained_range": [
            str(poly.LAST_GEOMETRY_MAINT.min()),
            str(poly.LAST_GEOMETRY_MAINT.max()),
        ],
    }
    sidewalks = ped[ped.footway == "sidewalk"]
    widths = estimate_widths(sidewalks, poly)
    sw = sidewalks.join(widths)
    report["width_estimate"] = {
        "osm_sidewalk_ways": len(sw),
        "estimated_pct_length": pct(
            sw.loc[sw.width_median.notna(), "length_m"].sum(), sw.length_m.sum()
        ),
        "median_of_medians_m": round(float(sw.width_median.median()), 2),
        "median_below_1_5m_pct_length": pct(
            sw.loc[sw.width_median < BASELINE_MIN_WIDTH_M, "length_m"].sum(),
            sw.loc[sw.width_median.notna(), "length_m"].sum(),
        ),
        "median_below_0_9m_pct_length": pct(
            sw.loc[sw.width_median < 0.9, "length_m"].sum(),
            sw.loc[sw.width_median.notna(), "length_m"].sum(),
        ),
    }
    tagged = sw.assign(tag_w=sw.width.map(measure.parse_width_m)).dropna(
        subset=["tag_w", "width_median"]
    )
    err = (tagged.width_median - tagged.tag_w).abs()
    width_margin = float(err.median()) if len(err) else 0.3
    report["width_validation"] = {
        "osm_ways_with_numeric_width_and_estimate": len(tagged),
        "median_abs_error_m": round(width_margin, 2),
        "mean_abs_error_m": round(float(err.mean()), 2) if len(err) else None,
        "bias_m": round(float((tagged.width_median - tagged.tag_w).mean()), 2)
        if len(err)
        else None,
    }

    # Corridor -----------------------------------------------------------------
    line, buf = corridor(ctx.ways, ctx.nodes)
    report["corridor"] = {
        "path_km": round(line.length / 1000, 2),
        "buffer_m": CORRIDOR_HALF_WIDTH_M,
    }
    cped = pedestrian_ways(ctx.ways, buf)
    ckerbs = crossing_kerbs(cped, ctx.nodes)
    report["osm_corridor"] = tag_completeness(cped, ckerbs)

    xs, ys = buf.exterior.xy
    tx = Transformer.from_crs(METRIC, 3979, always_xy=True)
    bx, by = tx.transform(np.array(xs), np.array(ys))
    bounds = (bx.min() - 20, by.min() - 20, bx.max() + 20, by.max() + 20)
    dtms = {"2023": read_dtm(DTM_2023, bounds), "2015": read_dtm(DTM_2015, bounds)}
    segs = segment(cped, SEGMENT_MAX_M)
    slopes = way_slopes(segs, dtms)
    cw = estimate_widths(segs[segs.footway == "sidewalk"], poly)
    c = segs.join(slopes).join(cw)
    c["kerb_state"] = c.way_index.map(ckerbs).fillna("unknown")
    report["corridor"]["segments"] = len(c)
    report["corridor"]["segment_max_m"] = SEGMENT_MAX_M

    both = c.dropna(subset=["max_slope_2023", "max_slope_2015"])
    diff = (both.max_slope_2023 - both.max_slope_2015).abs()
    slope_margin = float(diff.median())
    agree = (
        (both.max_slope_2023 <= BASELINE_MAX_RUNNING_SLOPE_PCT)
        == (both.max_slope_2015 <= BASELINE_MAX_RUNNING_SLOPE_PCT)
    ).mean()
    osm_incline = c.assign(tag_s=c.incline.map(measure.parse_incline_pct)).dropna(
        subset=["tag_s", "max_slope_2023"]
    )
    report["slope"] = {
        "dtm_2023": "TRCA-GTA_2023-1m (HRDEM lidar, 1 m)",
        "dtm_2015": "NRCAN-GTA2015-1m (HRDEM lidar, 1 m)",
        "ways_with_slope": int(c.max_slope_2023.notna().sum()),
        "ways_excluded_bridge_tunnel_steps_level": int(c.excluded.fillna(False).sum()),
        "slope_pct_length": pct(
            c.loc[c.max_slope_2023.notna(), "length_m"].sum(), c.length_m.sum()
        ),
        "median_abs_diff_2023_vs_2015_pp": round(slope_margin, 2),
        "p90_abs_diff_2023_vs_2015_pp": round(float(diff.quantile(0.9)), 2),
        "threshold_agreement_pct": round(float(agree) * 100, 1),
        "osm_incline_comparisons": len(osm_incline),
        "over_5pct_length_pct": pct(
            c.loc[c.max_slope_2023 > BASELINE_MAX_RUNNING_SLOPE_PCT, "length_m"].sum(),
            c.loc[c.max_slope_2023.notna(), "length_m"].sum(),
        ),
    }
    if len(osm_incline):
        report["slope"]["osm_incline_median_abs_diff_pp"] = round(
            float((osm_incline.max_slope_2023 - osm_incline.tag_s).abs().median()), 2
        )

    total = c.length_m.sum()

    def states_for(min_width: float) -> tuple[pd.Series, pd.DataFrame]:
        checks = pd.DataFrame(
            [attribute_checks(r, width_margin, slope_margin, min_width) for r in c.itertuples()],
            index=c.index,
        )
        return checks.apply(lambda r: knowledge_state(r.dropna().to_dict()), axis=1), checks

    c["state"], checks = states_for(BASELINE_MIN_WIDTH_M)
    report["corridor_states_pct_length"] = {
        s: pct(c.loc[c.state == s, "length_m"].sum(), total) for s in STATE_STYLE
    }
    report["corridor_barrier_causes_pct_length"] = {
        attr: pct(c.loc[checks[attr] == "fail", "length_m"].sum(), total) for attr in checks.columns
    }
    report["corridor_states_by_min_width"] = {}
    for w in WIDTH_SENSITIVITY_M:
        st, _ = states_for(w)
        report["corridor_states_by_min_width"][f"{w:.1f}"] = {
            s: pct(c.loc[st == s, "length_m"].sum(), total) for s in STATE_STYLE
        }
    report["corridor_attribute_known_pct_length"] = {
        "surface": pct(c.loc[c.surface.notna(), "length_m"].sum(), total),
        "width_estimate": pct(c.loc[c.width_median.notna(), "length_m"].sum(), total),
        "slope_2023": pct(c.loc[c.max_slope_2023.notna(), "length_m"].sum(), total),
        "slope_corroborated": pct(c.loc[checks.slope != "unknown", "length_m"].sum(), total),
        "kerb_both_ends_on_crossings": pct(
            c.loc[(c.footway == "crossing") & (c.kerb_state != "unknown"), "length_m"].sum(),
            c.loc[c.footway == "crossing", "length_m"].sum(),
        ),
    }

    # Ten locations a person must check on the ground before slope ships,
    # stratified across the slope range so the check measures error everywhere
    # rather than only at the extremes.
    has_slope = c.dropna(subset=["max_slope_2023"])
    has_slope = has_slope[has_slope.length_m >= 30]
    bins = [(0, 2, 2), (2, 4, 2), (4, 6, 2), (6, 8, 2), (8, 100, 2)]
    picks = []
    for lo, hi, n in bins:
        band = has_slope[(has_slope.max_slope_2023 >= lo) & (has_slope.max_slope_2023 < hi)]
        if len(band):
            picks.append(band.sample(min(n, len(band)), random_state=7))
    chosen = pd.concat(picks)
    pts = gpd.GeoSeries(chosen.geometry.interpolate(0.5, normalized=True), crs=METRIC).to_crs(4326)
    report["field_check_locations"] = [
        {
            "osm_way": int(r.osm_id),
            "lat": round(p.y, 6),
            "lon": round(p.x, 6),
            "max_slope_2023_pct": round(r.max_slope_2023, 1),
            "max_slope_2015_pct": None
            if np.isnan(r.max_slope_2015)
            else round(r.max_slope_2015, 1),
            "status": "not yet checked",
        }
        for (_, r), p in zip(chosen.iterrows(), pts, strict=True)
    ]
    report["corridor_steepest_ways"] = [
        {
            "osm_way": int(r.osm_id),
            "highway": r.highway,
            "footway": r.footway,
            "max_slope_2023_pct": round(r.max_slope_2023, 1),
            "max_slope_2015_pct": None
            if np.isnan(r.max_slope_2015)
            else round(r.max_slope_2015, 1),
        }
        for r in has_slope.sort_values("max_slope_2023", ascending=False).head(8).itertuples()
    ]

    (OUT / "reality_check.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    draw_maps(ctx, line, buf, c, both, tagged)
    print(
        json.dumps(
            {k: report[k] for k in ("corridor_states_pct_length", "slope", "width_validation")},
            indent=2,
        )
    )


def draw_maps(ctx: Context, line, buf, c, both, tagged) -> None:
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
    ny = ctx.ny

    fig, ax = plt.subplots(figsize=(9, 6), dpi=150)
    ctx.neighbourhoods.plot(
        ax=ax,
        column="osm_ratio",
        cmap="Greens",
        vmin=0,
        vmax=1.2,
        edgecolor="#FFFFFF",
        linewidth=0.4,
        legend=True,
        legend_kwds={"label": "OSM sidewalk length ÷ City inventory length", "shrink": 0.6},
        missing_kwds={"color": "#D9DBD6"},
    )
    ny.boundary.plot(ax=ax, color="#0D1411", linewidth=0.8)
    gpd.GeoSeries([buf], crs=METRIC).boundary.plot(
        ax=ax, color="#0D1411", linewidth=0.8, linestyle="--"
    )
    style_axes(ax, "North York: how much of the City's sidewalk inventory OpenStreetMap represents")
    fig.savefig(OUT / "map_osm_sidewalk_ratio.png", bbox_inches="tight")
    plt.close(fig)

    roads = ctx.ways[~ctx.ways.highway.isin(PED_HIGHWAYS) & ctx.ways.intersects(buf)]
    stations = ctx.nodes[ctx.nodes.railway.eq("station") & ctx.nodes.name.isin(CORRIDOR_STATIONS)]
    stations = stations.drop_duplicates("name")

    def context(ax):
        roads.geometry.intersection(buf).plot(ax=ax, color="#D9DBD6", linewidth=0.5, zorder=0)
        for _, st in stations.iterrows():
            ax.plot(
                st.geometry.x,
                st.geometry.y,
                "o",
                ms=6,
                mfc="#FFFFFF",
                mec="#0D1411",
                mew=1.4,
                zorder=5,
            )
            ax.annotate(
                st["name"],
                (st.geometry.x, st.geometry.y),
                xytext=(6, 6),
                textcoords="offset points",
                fontsize=8,
                color="#0D1411",
            )

    fig, ax = plt.subplots(figsize=(11, 5), dpi=170)
    context(ax)
    plot_lines(ax, c, "state")
    ax.legend(loc="lower left", frameon=False)
    style_axes(
        ax, "Demo corridor: knowledge state per 50 m segment, baseline profile (grey = roads)"
    )
    fig.savefig(OUT / "map_corridor_states.png", bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 5), dpi=170)
    context(ax)
    has = c.dropna(subset=["max_slope_2023"])
    has.plot(
        ax=ax,
        column="max_slope_2023",
        cmap="viridis",
        vmin=0,
        vmax=10,
        linewidth=1.3,
        legend=True,
        legend_kwds={"label": "Max 10 m running slope, % (2023 lidar)", "shrink": 0.6},
    )
    c[c.max_slope_2023.isna()].plot(ax=ax, color="#9AA09C", linestyle=":", linewidth=1)
    style_axes(
        ax, "Demo corridor: running slope from the 1 m lidar terrain model (dotted = no slope)"
    )
    fig.savefig(OUT / "map_corridor_slope.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(10, 4.4), dpi=150)
    axes[0].scatter(both.max_slope_2015, both.max_slope_2023, s=4, alpha=0.35, color="#0F3D2E")
    axes[0].plot([0, 15], [0, 15], color="#7A807C", linewidth=0.8)
    axes[0].set(
        xlim=(0, 15),
        ylim=(0, 15),
        xlabel="2015 lidar, max slope %",
        ylabel="2023 lidar, max slope %",
        title="Slope: two independent lidar surveys",
    )
    if len(tagged):
        axes[1].scatter(tagged.tag_w, tagged.width_median, s=8, alpha=0.5, color="#0F3D2E")
        axes[1].plot([0, 6], [0, 6], color="#7A807C", linewidth=0.8)
    axes[1].set(
        xlim=(0, 6),
        ylim=(0, 6),
        xlabel="OSM width tag, m",
        ylabel="Estimated from City polygons, m",
        title="Width: polygon estimate vs mapped tag",
    )
    for a in axes:
        a.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(OUT / "validation_slope_width.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
