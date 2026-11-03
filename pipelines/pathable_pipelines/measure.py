"""Measurement primitives shared by the reality check and the graph build.

Everything here is a pure function over geometries or arrays so it can be
unit-tested without downloading data.
"""

from __future__ import annotations

import re

import numpy as np
import shapely
from shapely.geometry import LineString

# Surface values that the baseline profile treats as passable, as a known
# barrier, or as too ambiguous to decide. Documented in docs/DATA_REPORT.md.
SURFACE_PASS = frozenset(
    {
        "asphalt",
        "concrete",
        "concrete:plates",
        "concrete:lanes",
        "paving_stones",
        "paved",
        "tartan",
        "rubber",
    }
)
SURFACE_FAIL = frozenset(
    {
        "gravel",
        "fine_gravel",
        "dirt",
        "ground",
        "grass",
        "sand",
        "mud",
        "earth",
        "unpaved",
        "compacted",
        "pebblestone",
        "woodchips",
        "sett",
        "cobblestone",
        "unhewn_cobblestone",
        "grass_paver",
        "rock",
    }
)

_NUMBER_M = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(m|metres?|meters?)?\s*$", re.IGNORECASE)
_PERCENT = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*%\s*$")


def parse_width_m(value: str | None) -> float | None:
    """OSM ``width`` in metres; ``None`` for feet, ranges or free text."""
    if not isinstance(value, str):
        return None
    m = _NUMBER_M.match(value)
    return float(m.group(1)) if m else None


def parse_incline_pct(value: str | None) -> float | None:
    """Absolute OSM ``incline`` in percent; ``None`` for up/down/degrees."""
    if not isinstance(value, str):
        return None
    m = _PERCENT.match(value)
    return abs(float(m.group(1))) if m else None


def classify_surface(value: str | None) -> str:
    if not isinstance(value, str):
        return "unknown"
    if value in SURFACE_PASS:
        return "pass"
    if value in SURFACE_FAIL:
        return "fail"
    return "unknown"


def split_line(line: LineString, step: float) -> np.ndarray:
    """Points every ``step`` metres along ``line`` including both ends, shape (n, 2)."""
    length = line.length
    n = max(int(np.ceil(length / step)), 1)
    distances = np.linspace(0.0, length, n + 1)
    return shapely.get_coordinates(shapely.line_interpolate_point(line, distances))


def bilinear(
    grid: np.ndarray, transform, xs: np.ndarray, ys: np.ndarray, nodata: float
) -> np.ndarray:
    """Bilinear sample of ``grid`` at map coordinates; NaN where any corner is nodata."""
    inv = ~transform
    cols = inv.a * xs + inv.b * ys + inv.c - 0.5
    rows = inv.d * xs + inv.e * ys + inv.f - 0.5
    c0 = np.floor(cols).astype(int)
    r0 = np.floor(rows).astype(int)
    fc = cols - c0
    fr = rows - r0
    h, w = grid.shape
    ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < w) & (r0 + 1 < h)
    out = np.full(xs.shape, np.nan)
    c0o, r0o, fco, fro = c0[ok], r0[ok], fc[ok], fr[ok]
    q = np.stack(
        [grid[r0o, c0o], grid[r0o, c0o + 1], grid[r0o + 1, c0o], grid[r0o + 1, c0o + 1]]
    ).astype(float)
    q[q == nodata] = np.nan
    top = q[0] * (1 - fco) + q[1] * fco
    bottom = q[2] * (1 - fco) + q[3] * fco
    out[ok] = top * (1 - fro) + bottom * fro
    return out


def running_slopes(elevations: np.ndarray, step_lengths: np.ndarray) -> np.ndarray:
    """Absolute running slope in percent for each consecutive pair of samples."""
    return np.abs(np.diff(elevations)) / step_lengths * 100.0


def window_slopes(elevations: np.ndarray, spacing: float, window: float) -> np.ndarray:
    """Running slope in percent over ``window`` metres of a smoothed elevation profile.

    The profile is median-filtered over five samples first so a single sample
    landing on a curb face or a lidar pit does not register as a steep stretch.
    """
    z = np.asarray(elevations, dtype=float)
    if len(z) >= 5:
        padded = np.pad(z, 2, mode="edge")
        stacked = np.lib.stride_tricks.sliding_window_view(padded, 5)
        z = np.nanmedian(stacked, axis=1) if np.isfinite(stacked).any() else z
    k = max(round(window / spacing), 1)
    if len(z) <= k:
        return np.array([])
    return np.abs(z[k:] - z[:-k]) / (k * spacing) * 100.0


def transects(
    line: LineString, step: float, half_length: float
) -> tuple[np.ndarray, list[LineString]]:
    """Sample points along ``line`` and perpendicular transects through each."""
    length = line.length
    distances = np.array([length / 2]) if length < step else np.arange(step / 2, length, step)
    pts = shapely.line_interpolate_point(line, distances)
    ahead = shapely.line_interpolate_point(line, np.minimum(distances + 0.5, length))
    behind = shapely.line_interpolate_point(line, np.maximum(distances - 0.5, 0))
    a = shapely.get_coordinates(ahead)
    b = shapely.get_coordinates(behind)
    p = shapely.get_coordinates(pts)
    d = a - b
    norm = np.hypot(d[:, 0], d[:, 1])
    norm[norm == 0] = 1
    nx, ny = -d[:, 1] / norm, d[:, 0] / norm
    lines = [
        LineString(
            [
                (px - nx_ * half_length, py - ny_ * half_length),
                (px + nx_ * half_length, py + ny_ * half_length),
            ]
        )
        for (px, py), nx_, ny_ in zip(p, nx, ny, strict=True)
    ]
    return p, lines


def width_at(point_xy: np.ndarray, transect: LineString, polygons) -> float | None:
    """Length of the transect piece inside ``polygons`` that contains the sample point.

    Returns ``None`` when the point is more than 1 m from any polygon piece,
    which means the polygon layer does not describe this stretch.
    """
    inside = transect.intersection(polygons)
    if inside.is_empty:
        return None
    pt = shapely.Point(point_xy)
    parts = list(getattr(inside, "geoms", [inside]))
    parts = [g for g in parts if g.geom_type == "LineString"]
    if not parts:
        return None
    nearest = min(parts, key=lambda g: g.distance(pt))
    if nearest.distance(pt) > 1.0:
        return None
    return nearest.length


def three_way(value: float | None, threshold: float, margin: float, higher_is_better: bool) -> str:
    """Classify a measured value against a threshold, refusing to decide near it.

    Values within ``margin`` (the measured error) of the threshold are
    ``unknown``: the measurement cannot tell which side of the line they are on.
    """
    if value is None or not np.isfinite(value):
        return "unknown"
    delta = value - threshold if higher_is_better else threshold - value
    if delta > margin:
        return "pass"
    if delta < -margin:
        return "fail"
    return "unknown"
