"""Database access. All SQL lives here; the app layer never builds queries."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .routing import Piece

WINTER = ("snow", "ice", "blocked_ramp")


class Database:
    def __init__(self, url: str):
        self.pool = ConnectionPool(url, min_size=1, max_size=10, kwargs={"row_factory": dict_row}, open=True)

    def close(self) -> None:
        self.pool.close()

    def ready(self) -> bool:
        with self.pool.connection() as c:
            return c.execute("SELECT count(*) AS n FROM data_versions").fetchone()["n"] > 0

    def latest_version(self) -> dict | None:
        with self.pool.connection() as c:
            return c.execute("SELECT id, built_at FROM data_versions ORDER BY built_at DESC LIMIT 1").fetchone()

    def coverage(self, version: str) -> dict:
        """The loaded area: its name (from the build's notes, "area=..."), size and bounds."""
        with self.pool.connection() as c:
            row = c.execute(
                """SELECT notes, ST_Area(coverage::geography) / 1e6 AS km2,
                          ST_XMin(coverage) AS w, ST_YMin(coverage) AS s, ST_XMax(coverage) AS e, ST_YMax(coverage) AS n
                   FROM data_versions WHERE id = %s""",
                (version,),
            ).fetchone()
        area = next((part[5:] for part in row["notes"].split() if part.startswith("area=")), "unknown")
        return {
            "area": area,
            "areaKm2": round(row["km2"], 1),
            "bbox": [round(row[k], 5) for k in ("w", "s", "e", "n")],
        }

    def in_coverage(self, version: str, lon: float, lat: float) -> bool:
        with self.pool.connection() as c:
            row = c.execute(
                "SELECT ST_Covers(coverage, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) AS ok"
                " FROM data_versions WHERE id = %s",
                (lon, lat, version),
            ).fetchone()
            return bool(row and row["ok"])

    def pieces(self, version: str) -> list[Piece]:
        with self.pool.connection() as c:
            hazards: dict[str, list[dict]] = {}
            for h in c.execute(
                """SELECT id, kind, status, source, observed_on, expires_at, edge_id,
                          ST_X(geom) AS lon, ST_Y(geom) AS lat FROM hazards
                   WHERE data_version = %s AND edge_id IS NOT NULL AND (expires_at IS NULL OR expires_at > now())""",
                (version,),
            ):
                hazards.setdefault(h["edge_id"], []).append(_hazard(h))
            rows = c.execute(
                "SELECT id, kind, street, evidence, ST_AsGeoJSON(geom)::json AS g FROM edges WHERE data_version = %s",
                (version,),
            ).fetchall()
        return [
            Piece(
                id=r["id"],
                kind=r["kind"],
                street=r["street"],
                coords=tuple(tuple(p) for p in r["g"]["coordinates"]),
                evidence=tuple(r["evidence"]),
                hazards=tuple(hazards.get(r["id"], ())),
            )
            for r in rows
        ]

    def hazards_in(self, bbox: tuple[float, float, float, float]) -> list[dict]:
        """Unexpired measured hazards plus open community reports inside bbox."""
        with self.pool.connection() as c:
            measured = c.execute(
                """SELECT id, kind, status, source, observed_on, expires_at, edge_id,
                          ST_X(geom) AS lon, ST_Y(geom) AS lat
                   FROM hazards WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                   AND data_version = (SELECT id FROM data_versions ORDER BY built_at DESC LIMIT 1)
                   AND (expires_at IS NULL OR expires_at > now())""",
                bbox,
            ).fetchall()
            reported = c.execute(
                """SELECT id::text, kind, CASE WHEN status = 'verified' THEN 'verified' ELSE 'reported' END AS status,
                          'community-report' AS source, observed_on, expires_at, NULL::text AS edge_id,
                          ST_X(geom) AS lon, ST_Y(geom) AS lat
                   FROM reports WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                   AND status IN ('received','under_review','verified')
                   AND (expires_at IS NULL OR expires_at > now())""",
                bbox,
            ).fetchall()
        return [_hazard(h) for h in [*measured, *reported]]

    def open_reports(self, bbox: tuple[float, float, float, float]) -> list[dict]:
        """Community reports that are still open (not rejected, withdrawn or expired) inside bbox."""
        with self.pool.connection() as c:
            rows = c.execute(
                """SELECT id::text, kind, CASE WHEN status = 'verified' THEN 'verified' ELSE 'reported' END AS status,
                          'community-report' AS source, observed_on, expires_at, NULL::text AS edge_id,
                          ST_X(geom) AS lon, ST_Y(geom) AS lat
                   FROM reports WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                   AND status IN ('received','under_review','verified')
                   AND (expires_at IS NULL OR expires_at > now())""",
                bbox,
            ).fetchall()
        return [_hazard(r) for r in rows]

    def create_report(
        self, kind: str, lon: float, lat: float, description: str, photo_id: str | None, observed_on
    ) -> dict:
        """Store a report and return its receipt, including the one-time withdraw token."""
        token = secrets.token_urlsafe(24)
        with self.pool.connection() as c, c.transaction():
            r = c.execute(
                """INSERT INTO reports (kind, description, photo_id, observed_on, expires_at, geom, withdraw_token_hash)
                   VALUES (%s, %s, %s, %s,
                           CASE WHEN %s = ANY(%s) THEN now() + interval '48 hours' END,
                           ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                   RETURNING id::text, status, received_at""",
                (kind, description, photo_id, observed_on, kind, list(WINTER), lon, lat, _token_hash(token)),
            ).fetchone()
            c.execute(
                "INSERT INTO report_events (report_id, from_status, to_status, actor)"
                " VALUES (%s, NULL, 'received', 'reporter')",
                (r["id"],),
            )
        return {**_receipt(r), "withdrawToken": token}

    def withdraw(self, report_id: str, token: str) -> dict:
        """Withdraw a report for the person holding its token.

        A wrong token raises the same NoDataFound as an unknown id, so a report's
        existence is not confirmed to someone who only saw its id on the map.
        """
        with self.pool.connection() as c, c.transaction():
            row = c.execute("SELECT withdraw_token_hash FROM reports WHERE id = %s::uuid", (report_id,)).fetchone()
            stored = row and row["withdraw_token_hash"]
            if not stored or not hmac.compare_digest(bytes(stored), _token_hash(token)):
                raise psycopg.errors.NoDataFound("report not found")
            r = c.execute(
                "SELECT id::text, status, received_at FROM transition_report(%s::uuid, 'withdrawn', 'reporter')",
                (report_id,),
            ).fetchone()
        return _receipt(r)

    def transition(self, report_id: str, to_status: str, actor: str) -> dict:
        with self.pool.connection() as c:
            r = c.execute(
                "SELECT id::text, status, received_at FROM transition_report(%s::uuid, %s, %s)",
                (report_id, to_status, actor),
            ).fetchone()
        return _receipt(r)

    def report_events(self, report_id: str) -> list[dict]:
        with self.pool.connection() as c:
            return c.execute(
                "SELECT from_status, to_status, actor FROM report_events WHERE report_id = %s::uuid ORDER BY id",
                (report_id,),
            ).fetchall()


def _hazard(h: dict) -> dict:
    return {
        "id": h["id"],
        "kind": h["kind"],
        "status": h["status"],
        "location": [round(h["lon"], 6), round(h["lat"], 6)],
        "source": h["source"],
        "observedOn": h["observed_on"].isoformat(),
        "expiresAt": h["expires_at"].astimezone(UTC).isoformat() if h["expires_at"] else None,
        "segmentId": h["edge_id"],
    }


def _token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def _receipt(r: dict) -> dict:
    received = (
        r["received_at"] if isinstance(r["received_at"], datetime) else datetime.fromisoformat(str(r["received_at"]))
    )
    return {
        "id": r["id"],
        "status": r["status"],
        "receivedAt": received.astimezone(UTC).isoformat(),
    }


def load_graph(
    conn_url: str,
    version: str,
    coverage_wkt: str,
    edges: list[dict],
    hazards: list[dict],
    notes: str = "",
) -> None:
    """Replace one data version atomically (used by the pipeline and tests)."""
    import psycopg

    with psycopg.connect(conn_url) as c, c.transaction():
        c.execute("DELETE FROM data_versions WHERE id = %s", (version,))
        c.execute(
            "INSERT INTO data_versions (id, coverage, notes) VALUES (%s, ST_Multi(ST_GeomFromText(%s, 4326)), %s)",
            (version, coverage_wkt, notes),
        )
        with c.cursor() as cur:
            cur.executemany(
                """INSERT INTO edges (id, data_version, osm_way, kind, street, length_m, evidence, geom)
                   VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, ST_GeomFromText(%s, 4326))""",
                [
                    (
                        e["id"],
                        version,
                        e.get("osm_way"),
                        e["kind"],
                        e.get("street"),
                        e["length_m"],
                        json.dumps(e["evidence"]),
                        e["wkt"],
                    )
                    for e in edges
                ],
            )
            cur.executemany(
                """INSERT INTO hazards (data_version, id, kind, status, source, observed_on, expires_at, edge_id, geom)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))""",
                [
                    (
                        version,
                        h["id"],
                        h["kind"],
                        h["status"],
                        h["source"],
                        h["observedOn"],
                        h.get("expiresAt"),
                        h.get("edge_id"),
                        *h["location"],
                    )
                    for h in hazards
                ],
            )
