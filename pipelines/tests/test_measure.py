import numpy as np
import pytest
from affine import Affine
from shapely.geometry import LineString, box

from pathable_pipelines import measure


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("1.5", 1.5), ("2 m", 2.0), ("1.8m", 1.8), ("3'", None), ("1-2", None), (None, None)],
)
def test_parse_width(raw, expected):
    assert measure.parse_width_m(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"), [("5%", 5.0), ("-8.3%", 8.3), ("up", None), ("10°", None), (None, None)]
)
def test_parse_incline(raw, expected):
    assert measure.parse_incline_pct(raw) == expected


def test_surface_unknown_is_never_pass():
    assert measure.classify_surface(None) == "unknown"
    assert measure.classify_surface("wood") == "unknown"
    assert measure.classify_surface("concrete") == "pass"
    assert measure.classify_surface("gravel") == "fail"


def test_bilinear_on_plane_is_exact():
    # z = x + 2y on a 1 m grid; pixel centres at half-integers.
    xs, ys = np.meshgrid(np.arange(10) + 0.5, np.arange(10) + 0.5)
    grid = (xs + 2 * (10 - ys)).astype("float32")
    transform = Affine(1, 0, 0, 0, -1, 10)
    px = np.array([2.3, 5.75])
    py = np.array([7.1, 3.2])
    got = measure.bilinear(grid, transform, px, py, nodata=-32767)
    np.testing.assert_allclose(got, px + 2 * (10 - (10 - py)) - 0, rtol=0, atol=1e-4)


def test_bilinear_nodata_is_nan():
    grid = np.ones((4, 4), dtype="float32")
    grid[1, 1] = -32767
    got = measure.bilinear(
        grid, Affine(1, 0, 0, 0, -1, 4), np.array([1.4]), np.array([2.6]), -32767
    )
    assert np.isnan(got[0])


def test_running_slopes():
    np.testing.assert_allclose(
        measure.running_slopes(np.array([100.0, 100.5, 100.0]), np.array([10.0, 10.0])), [5.0, 5.0]
    )


def test_width_from_transect_matches_rectangle():
    sidewalk = box(0, 0, 100, 1.8)  # 1.8 m wide strip
    line = LineString([(0, 0.9), (100, 0.9)])
    pts, lines = measure.transects(line, step=10, half_length=6)
    widths = [measure.width_at(p, t, sidewalk) for p, t in zip(pts, lines, strict=True)]
    assert len(widths) == 10
    np.testing.assert_allclose(widths, 1.8, atol=1e-9)


def test_width_none_when_polygon_absent():
    far = box(0, 50, 100, 52)
    pts, lines = measure.transects(LineString([(0, 0), (100, 0)]), step=10, half_length=6)
    assert measure.width_at(pts[0], lines[0], far) is None


@pytest.mark.parametrize(
    ("value", "expected"),
    [(3.0, "pass"), (4.7, "unknown"), (5.3, "unknown"), (7.0, "fail"), (None, "unknown")],
)
def test_three_way_refuses_near_threshold(value, expected):
    assert measure.three_way(value, threshold=5.0, margin=0.5, higher_is_better=False) == expected


def test_window_slopes_ignore_single_curb_spike():
    # 4% grade sampled every 2 m with one 15 cm spike from a curb face.
    z = np.arange(0, 60, 2) * 0.04
    z[10] += 0.15
    got = measure.window_slopes(z, spacing=2, window=10)
    raw = np.abs(z[5:] - z[:-5]) / 10 * 100
    assert raw.max() == pytest.approx(5.5)  # unsmoothed, the spike reads as 5.5 %
    assert got.max() < 5.0
    assert np.median(got) == pytest.approx(4.0)


def test_window_slopes_too_short():
    assert measure.window_slopes(np.array([0.0, 0.1]), spacing=2, window=10).size == 0


def test_parse_width_nan_is_none():
    assert measure.parse_width_m(float("nan")) is None
