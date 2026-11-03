"""GTFS parsing details that are easy to get wrong."""

from pathable_pipelines.transit import gtfs_date, gtfs_seconds


def test_times_past_midnight_stay_on_the_service_day():
    # GTFS writes a 00:30 trip that belongs to the previous day's service as 24:30:00.
    assert gtfs_seconds("24:30:00") == 24 * 3600 + 30 * 60
    assert gtfs_seconds(" 8:05:09") == 8 * 3600 + 5 * 60 + 9


def test_dates():
    assert gtfs_date("20261104") == "2026-11-04"
