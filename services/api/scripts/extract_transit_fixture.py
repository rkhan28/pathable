"""Cut a small, real slice of the loaded TTC schedule for the API tests.

Keeps Wednesday 4 November 2026, 08:00-08:40 departures on Line 1, Line 6
(Finch West LRT) and the 41 Keele bus, at stops within 1.5 km of the test
corridor. The rows are copied as they are, so the tests run the planner on
the real schedule rather than on numbers we made up.

  DATABASE_URL=... uv run python scripts/extract_transit_fixture.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "fixtures"
DAY = "2026-11-04"
LINES = ["1", "6", "41"]
FROM_S, TO_S = 8 * 3600, 8 * 3600 + 40 * 60
NEAR_M = 1500


def main() -> None:
    coverage = json.loads((FIXTURES / "graph-york-u-finch-west.json").read_text())["coverage_wkt"]
    c = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
    c.execute(
        """CREATE TEMP TABLE keep_stops AS
             SELECT stop_id FROM transit_stops
              WHERE ST_DWithin(geom::geography, ST_GeomFromText(%s, 4326)::geography, %s)""",
        (coverage, NEAR_M),
    )
    c.execute(
        """CREATE TEMP TABLE keep_trips AS
             SELECT DISTINCT t.trip_id
               FROM transit_trips t
               JOIN transit_routes r USING (route_id)
               JOIN transit_calendar cal USING (service_id)
               JOIN transit_stop_times st USING (trip_id)
              WHERE r.short_name = ANY(%s)
                AND %s::date BETWEEN cal.start_date AND cal.end_date
                AND cal.days[extract(isodow FROM %s::date)]
                AND st.stop_id IN (SELECT stop_id FROM keep_stops)
                AND st.departure_s BETWEEN %s AND %s""",
        (LINES, DAY, DAY, FROM_S, TO_S),
    )

    def rows(sql: str) -> list[dict]:
        return [dict(r) for r in c.execute(sql).fetchall()]

    doc = {
        "about": f"Real TTC GTFS rows for {DAY}, lines {', '.join(LINES)}, 08:00-08:40, near the test corridor.",
        "feed": rows("SELECT id, publisher, valid_from::text, valid_to::text FROM transit_feed"),
        "stops": rows(
            """SELECT stop_id, name, round(ST_X(geom)::numeric, 6)::float AS lon,
                      round(ST_Y(geom)::numeric, 6)::float AS lat, wheelchair_boarding
                 FROM transit_stops WHERE stop_id IN (SELECT stop_id FROM keep_stops) ORDER BY stop_id"""
        ),
        "routes": rows(
            """SELECT * FROM transit_routes WHERE route_id IN
                 (SELECT route_id FROM transit_trips WHERE trip_id IN (SELECT trip_id FROM keep_trips))
               ORDER BY route_id"""
        ),
        "trips": rows("SELECT * FROM transit_trips WHERE trip_id IN (SELECT trip_id FROM keep_trips) ORDER BY trip_id"),
        "stop_times": rows(
            """SELECT * FROM transit_stop_times
                WHERE trip_id IN (SELECT trip_id FROM keep_trips)
                  AND stop_id IN (SELECT stop_id FROM keep_stops)
                ORDER BY trip_id, stop_sequence"""
        ),
        "shapes": rows(
            """SELECT shape_id, length,
                      (ST_AsGeoJSON(geom, 6)::json -> 'coordinates') AS coordinates
                 FROM transit_shapes WHERE shape_id IN
                   (SELECT shape_id FROM transit_trips WHERE trip_id IN (SELECT trip_id FROM keep_trips))
                ORDER BY shape_id"""
        ),
        "calendar": rows(
            """SELECT service_id, days, start_date::text, end_date::text FROM transit_calendar
                WHERE service_id IN (SELECT service_id FROM transit_trips
                                      WHERE trip_id IN (SELECT trip_id FROM keep_trips))"""
        ),
    }
    out = FIXTURES / "transit-york-u-finch-west.json"
    out.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    print(out, {k: len(v) for k, v in doc.items() if isinstance(v, list)}, f"{out.stat().st_size / 1e3:.0f} kB")


if __name__ == "__main__":
    main()
