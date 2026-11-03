"""Load the TTC GTFS schedule for the pilot area into PostGIS.

Usage:
  uv run python -m pathable_pipelines.transit --load $DATABASE_URL

Keeps the stops within the area (North York plus about 1 km), every trip that
serves at least one of them, and those trips' stop times at kept stops. The
whole load runs in one transaction, so the API never sees half a feed.
"""

from __future__ import annotations

import argparse
import csv
import io
import zipfile
from pathlib import Path

import psycopg

# North York's bounding box widened by about 1 km, so stops just over the
# boundary (Steeles, Bathurst, Victoria Park) are reachable on foot.
AREA = (-79.5953, 43.6829, -79.2891, 43.8257)


def _rows(z: zipfile.ZipFile, name: str):
    with z.open(name) as fh:
        yield from csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"))


def gtfs_seconds(hhmmss: str) -> int:
    h, m, s = (int(x) for x in hhmmss.strip().split(":"))
    return h * 3600 + m * 60 + s


def gtfs_date(yyyymmdd: str) -> str:
    return f"{yyyymmdd[:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:]}"


def load(gtfs: Path, url: str) -> dict:
    z = zipfile.ZipFile(gtfs)
    w, s, e, n = AREA
    stops = {}
    for r in _rows(z, "stops.txt"):
        if not r["stop_lon"] or r.get("location_type", "0") not in ("", "0"):
            continue
        x, y = float(r["stop_lon"]), float(r["stop_lat"])
        if w <= x <= e and s <= y <= n:
            stops[r["stop_id"]] = (r["stop_name"], x, y, int(r.get("wheelchair_boarding") or 0))

    stop_times: list[tuple] = []
    trips_used: set[str] = set()
    for r in _rows(z, "stop_times.txt"):
        if r["stop_id"] in stops:
            trips_used.add(r["trip_id"])
            stop_times.append(
                (
                    r["trip_id"],
                    int(r["stop_sequence"]),
                    r["stop_id"],
                    gtfs_seconds(r["arrival_time"]),
                    gtfs_seconds(r["departure_time"]),
                    float(r["shape_dist_traveled"]) if r.get("shape_dist_traveled") else None,
                )
            )
    trips = [
        (
            r["trip_id"],
            r["route_id"],
            r["service_id"],
            r.get("trip_headsign", ""),
            int(r.get("wheelchair_accessible") or 0),
            r.get("shape_id") or None,
        )
        for r in _rows(z, "trips.txt")
        if r["trip_id"] in trips_used
    ]
    route_ids = {t[1] for t in trips}
    shape_ids = {t[5] for t in trips if t[5]}
    points: dict[str, list[tuple[int, float, float, float]]] = {}
    for r in _rows(z, "shapes.txt"):
        if r["shape_id"] in shape_ids:
            points.setdefault(r["shape_id"], []).append(
                (
                    int(r["shape_pt_sequence"]),
                    float(r["shape_pt_lon"]),
                    float(r["shape_pt_lat"]),
                    float(r.get("shape_dist_traveled") or 0),
                )
            )
    routes = [
        (
            r["route_id"],
            r["route_short_name"],
            r["route_long_name"],
            int(r["route_type"]),
            (r.get("route_color") or None),
        )
        for r in _rows(z, "routes.txt")
        if r["route_id"] in route_ids
    ]
    days = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    calendar = [
        (
            r["service_id"],
            [r[d] == "1" for d in days],
            gtfs_date(r["start_date"]),
            gtfs_date(r["end_date"]),
        )
        for r in _rows(z, "calendar.txt")
    ]
    calendar_dates = [
        (r["service_id"], gtfs_date(r["date"]), int(r["exception_type"]))
        for r in _rows(z, "calendar_dates.txt")
    ]
    info = next(_rows(z, "feed_info.txt"))

    with psycopg.connect(url) as c, c.transaction():
        c.execute(
            "TRUNCATE transit_shapes, transit_stop_times, transit_trips, transit_routes,"
            " transit_stops, transit_calendar, transit_calendar_dates, transit_feed"
        )
        c.execute(
            "INSERT INTO transit_feed (id, publisher, valid_from, valid_to)"
            " VALUES (%s, %s, %s, %s)",
            (
                info["feed_version"],
                info["feed_publisher_name"],
                gtfs_date(info["feed_start_date"]),
                gtfs_date(info["feed_end_date"]),
            ),
        )
        with c.cursor() as cur:
            with cur.copy(
                "COPY transit_stops (stop_id, name, geom, wheelchair_boarding) FROM STDIN"
            ) as cp:
                for sid, (name, x, y, wb) in stops.items():
                    cp.write_row((sid, name, f"SRID=4326;POINT({x} {y})", wb))
            with cur.copy("COPY transit_routes FROM STDIN") as cp:
                for r in routes:
                    cp.write_row(r)
            with cur.copy("COPY transit_trips FROM STDIN") as cp:
                for t in trips:
                    cp.write_row(t)
            with cur.copy("COPY transit_stop_times FROM STDIN") as cp:
                for st in stop_times:
                    cp.write_row(st)
            with cur.copy("COPY transit_shapes (shape_id, geom, length) FROM STDIN") as cp:
                for sid, pts in points.items():
                    pts.sort()
                    if len(pts) < 2:
                        continue
                    line = ", ".join(f"{x} {y}" for _, x, y, _ in pts)
                    cp.write_row((sid, f"SRID=4326;LINESTRING({line})", pts[-1][3]))
            with cur.copy("COPY transit_calendar FROM STDIN") as cp:
                for r in calendar:
                    cp.write_row(r)
            with cur.copy("COPY transit_calendar_dates FROM STDIN") as cp:
                for r in calendar_dates:
                    cp.write_row(r)
        c.execute("ANALYZE transit_stop_times; ANALYZE transit_trips; ANALYZE transit_stops")
    return {
        "feed": info["feed_version"],
        "stops": len(stops),
        "routes": len(routes),
        "trips": len(trips),
        "stop_times": len(stop_times),
        "shapes": len(points),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--gtfs",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data/raw/toronto/ttc_gtfs.zip",
    )
    ap.add_argument("--load", required=True, help="DATABASE_URL")
    args = ap.parse_args()
    print(load(args.gtfs, args.load))


if __name__ == "__main__":
    main()
