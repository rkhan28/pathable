"""Accessible transit options: walk, ride one TTC vehicle, walk.

For a trip, the planner:
1. walks the evidence graph outward from the origin and the destination, so
   it knows the real walking cost to every stop within reach (not a straight
   line), with the same knowledge states as walking routes;
2. asks PostGIS for trips running today that leave a reachable origin stop
   after you could get there and stop at a reachable destination stop;
3. keeps the best trip per line, and builds each option as walk, ride, walk.

Trips and stops that the schedule marks as not wheelchair accessible are
never offered. Where the schedule does not say, the option is marked as
unknown rather than accessible. Only single-vehicle options are planned
for now; transfers are not.
"""

from __future__ import annotations

import itertools
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from .routing import EvidenceGraph, metres

TORONTO = ZoneInfo("America/Toronto")
WALK_SPEED_MPS = 1.0
WALK_REACH_M = 700  # furthest walk to or from a stop that we consider
MAX_STOPS = 12  # nearest reachable stops considered at each end
SEARCH_WINDOW_S = 75 * 60
MAX_OPTIONS = 3
MIN_WALK_LEG_M = 5.0

MODE = {0: "streetcar", 1: "subway", 2: "rail", 3: "bus"}
LRT_LINES = {"5", "6"}  # TTC lines 5 (Eglinton) and 6 (Finch West) are light rail, GTFS type 0


def mode_of(route_type: int, short_name: str) -> str:
    if route_type == 0 and short_name in LRT_LINES:
        return "lrt"
    return MODE.get(route_type, "bus")


ACTIVE_SERVICES = """
    SELECT service_id FROM transit_calendar
     WHERE %(day)s BETWEEN start_date AND end_date AND days[%(dow)s]
    UNION
    SELECT service_id FROM transit_calendar_dates WHERE date = %(day)s AND exception_type = 1
    EXCEPT
    SELECT service_id FROM transit_calendar_dates WHERE date = %(day)s AND exception_type = 2
"""

CONNECTIONS = f"""
WITH o(stop_id, earliest) AS (SELECT * FROM unnest(%(o_ids)s::text[], %(o_earliest)s::int[])),
     d(stop_id, walk_s) AS (SELECT * FROM unnest(%(d_ids)s::text[], %(d_walk)s::int[])),
     active AS ({ACTIVE_SERVICES})
SELECT DISTINCT ON (t.route_id)
       t.trip_id, t.route_id, t.headsign, t.wheelchair_accessible, t.shape_id,
       a.stop_id AS board_id, a.stop_sequence AS board_seq, a.departure_s, a.shape_dist AS board_dist,
       b.stop_id AS alight_id, b.stop_sequence AS alight_seq, b.arrival_s, b.shape_dist AS alight_dist,
       b.arrival_s + d.walk_s AS reach_s
  FROM o
  JOIN transit_stop_times a ON a.stop_id = o.stop_id AND a.departure_s BETWEEN o.earliest AND o.earliest + %(window)s
  JOIN transit_trips t ON t.trip_id = a.trip_id AND t.wheelchair_accessible <> 2
       AND t.service_id IN (SELECT service_id FROM active)
  JOIN transit_stop_times b ON b.trip_id = a.trip_id AND b.stop_sequence > a.stop_sequence
  JOIN d ON d.stop_id = b.stop_id
 ORDER BY t.route_id, reach_s
"""

# The part of the vehicle's own path between the two stops, so a ride is drawn
# where it really goes (a subway line that loops downtown is drawn downtown).
# Each stop is snapped onto the path; if a looping route makes that ambiguous
# (alighting would come before boarding), fall back to the published distances.
RIDE_PATH = """
WITH s AS (
  SELECT geom, ST_LineLocatePoint(geom, ST_SetSRID(ST_MakePoint(%(ax)s, %(ay)s), 4326)) AS fa,
               ST_LineLocatePoint(geom, ST_SetSRID(ST_MakePoint(%(bx)s, %(by)s), 4326)) AS fb,
               LEAST(1, GREATEST(0, %(a)s / NULLIF(length, 0))) AS da,
               LEAST(1, GREATEST(0, %(b)s / NULLIF(length, 0))) AS db
    FROM transit_shapes WHERE shape_id = %(shape)s
)
SELECT ST_AsGeoJSON(CASE WHEN fa < fb THEN ST_LineSubstring(geom, fa, fb)
                         WHEN da < db THEN ST_LineSubstring(geom, da, db) END)::json AS g
  FROM s
"""


def _iso(day: date, seconds: int) -> str:
    midnight = datetime(day.year, day.month, day.day, tzinfo=TORONTO)
    return (midnight + timedelta(seconds=seconds)).astimezone(UTC).isoformat().replace("+00:00", "Z")


class TransitPlanner:
    def __init__(self, db, graph: EvidenceGraph):
        self.db = db
        self.graph = graph

    def feed(self) -> dict | None:
        with self.db.pool.connection() as c:
            return c.execute("SELECT id, valid_from, valid_to FROM transit_feed LIMIT 1").fetchone()

    def _stops_near(self, c, p, tree) -> list[dict]:
        """Accessible-or-unknown stops near p, with the real walking path to each."""
        rows = c.execute(
            """SELECT stop_id, name, ST_X(geom) AS lon, ST_Y(geom) AS lat, wheelchair_boarding
                 FROM transit_stops
                WHERE wheelchair_boarding <> 2
                  AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)""",
            (p[0], p[1], WALK_REACH_M),
        ).fetchall()
        _, cost, paths = tree
        out = []
        for r in rows:
            node, snap = self.graph.nearest((r["lon"], r["lat"]))
            if snap > 40 or node not in paths:
                continue
            path = paths[node]
            length = sum(metres(a, b) for a, b in itertools.pairwise(path)) + snap
            # A stop at the very node we start from has no walk to draw.
            walks = len(path) >= 2 and length >= MIN_WALK_LEG_M
            out.append(
                {
                    **r,
                    "path": path,
                    "walks": walks,
                    "walk_m": length if walks else 0.0,
                    "walk_s": round(length / WALK_SPEED_MPS) if walks else 0,
                    "cost": cost[node],
                }
            )
        return sorted(out, key=lambda s: s["cost"])[:MAX_STOPS]

    def plan(self, origin, destination, prefs, now: datetime) -> list[dict]:
        o_tree = self.graph.walk_tree(origin, prefs, WALK_REACH_M)
        d_tree = self.graph.walk_tree(destination, prefs, WALK_REACH_M)
        if not o_tree or not d_tree:
            return []
        local = now.astimezone(TORONTO)
        day = local.date()
        now_s = local.hour * 3600 + local.minute * 60 + local.second
        with self.db.pool.connection() as c:
            o_stops = self._stops_near(c, origin, o_tree)
            d_stops = self._stops_near(c, destination, d_tree)
            if not o_stops or not d_stops:
                return []
            rows = c.execute(
                CONNECTIONS,
                {
                    "o_ids": [s["stop_id"] for s in o_stops],
                    "o_earliest": [now_s + s["walk_s"] for s in o_stops],
                    "d_ids": [s["stop_id"] for s in d_stops],
                    "d_walk": [s["walk_s"] for s in d_stops],
                    "window": SEARCH_WINDOW_S,
                    "day": day,
                    "dow": local.isoweekday(),
                },
            ).fetchall()
            rows = sorted(rows, key=lambda r: r["reach_s"])[:MAX_OPTIONS]
            routes = {
                r["route_id"]: r
                for r in c.execute(
                    "SELECT route_id, short_name, long_name, route_type, color"
                    "  FROM transit_routes WHERE route_id = ANY(%s)",
                    ([r["route_id"] for r in rows],),
                ).fetchall()
            }
            options = []
            for i, r in enumerate(rows):
                path = None
                if r["shape_id"]:
                    board = next(s for s in o_stops if s["stop_id"] == r["board_id"])
                    alight = next(s for s in d_stops if s["stop_id"] == r["alight_id"])
                    row = c.execute(
                        RIDE_PATH,
                        {
                            "ax": board["lon"],
                            "ay": board["lat"],
                            "bx": alight["lon"],
                            "by": alight["lat"],
                            "a": r["board_dist"] or 0,
                            "b": r["alight_dist"] or 0,
                            "shape": r["shape_id"],
                        },
                    ).fetchone()
                    path = row["g"]["coordinates"] if row and row["g"] else None
                options.append(self._option(i, r, routes[r["route_id"]], path, o_stops, d_stops, day, prefs))
        return options

    def _option(self, i, r, route, path, o_stops, d_stops, day, prefs) -> dict:
        board = next(s for s in o_stops if s["stop_id"] == r["board_id"])
        alight = next(s for s in d_stops if s["stop_id"] == r["alight_id"])
        legs: list[dict] = []
        if board["walks"]:
            legs.append({"kind": "walk", "route": self.graph.walk_route(board["path"], f"t{i}-to-stop", prefs)})
        step_free = (
            "yes"
            if r["wheelchair_accessible"] == 1
            and board["wheelchair_boarding"] == 1
            and alight["wheelchair_boarding"] == 1
            else "unknown"
        )
        legs.append(
            {
                "kind": "ride",
                "mode": mode_of(route["route_type"], route["short_name"]),
                "line": route["short_name"],
                "name": route["long_name"],
                "color": f"#{route['color']}" if route["color"] else None,
                "headsign": r["headsign"],
                "from": {"name": board["name"], "location": [round(board["lon"], 6), round(board["lat"], 6)]},
                "to": {"name": alight["name"], "location": [round(alight["lon"], 6), round(alight["lat"], 6)]},
                "departAt": _iso(day, r["departure_s"]),
                "arriveAt": _iso(day, r["arrival_s"]),
                # TTC numbers each trip's stops consecutively, so the difference is the stop count.
                "stops": max(1, r["alight_seq"] - r["board_seq"]),
                "geometry": [[round(x, 6), round(y, 6)] for x, y in path]
                if path and len(path) >= 2
                else [
                    [round(board["lon"], 6), round(board["lat"], 6)],
                    [round(alight["lon"], 6), round(alight["lat"], 6)],
                ],
                "stepFree": step_free,
            }
        )
        if alight["walks"]:
            # The tree was grown from the destination, so the path runs destination -> stop.
            legs.append(
                {
                    "kind": "walk",
                    "route": self.graph.walk_route(list(reversed(alight["path"])), f"t{i}-from-stop", prefs),
                }
            )
        depart_s = r["departure_s"] - board["walk_s"]
        arrive_s = r["reach_s"]
        walks = [leg["route"] for leg in legs if leg["kind"] == "walk"]
        return {
            "id": f"transit-{i}",
            "legs": legs,
            "departAt": _iso(day, depart_s),
            "arriveAt": _iso(day, arrive_s),
            "durationS": arrive_s - depart_s,
            "walkingM": round(sum(w["distanceM"] for w in walks), 1),
            "barrierCount": sum(w["barrierCount"] for w in walks),
            "stepFree": step_free,
        }
