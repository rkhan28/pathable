"""Integration fixtures: a real PostGIS in a container, migrated with Alembic,
loaded with a small slice of the real North York evidence graph."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
API = Path(__file__).resolve().parents[1]
GRAPH_FIXTURE = ROOT / "contracts" / "fixtures" / "graph-york-u-finch-west.json"
TRANSIT_FIXTURE = ROOT / "contracts" / "fixtures" / "transit-york-u-finch-west.json"
POSTGIS_IMAGE = os.environ.get("POSTGIS_IMAGE", "imresamu/postgis:16-3.5")


@pytest.fixture(scope="session")
def database_url():
    if url := os.environ.get("TEST_DATABASE_URL"):
        yield url
        return
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer(
        POSTGIS_IMAGE, username="pathable", password="pathable", dbname="pathable", driver=None
    ) as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session")
def migrated(database_url):
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=API,
        check=True,
        env={**os.environ, "DATABASE_URL": database_url},
    )
    from pathable_api.db import load_graph

    doc = json.loads(GRAPH_FIXTURE.read_text())
    load_graph(
        database_url,
        doc["version"],
        doc["coverage_wkt"],
        doc["edges"],
        doc["hazards"],
        notes="test",
    )
    load_transit(database_url, json.loads(TRANSIT_FIXTURE.read_text()))
    return database_url


def load_transit(url: str, doc: dict) -> None:
    """Insert the real schedule slice cut by scripts/extract_transit_fixture.py."""
    import psycopg

    with psycopg.connect(url) as c, c.cursor() as cur:
        cur.executemany(
            "INSERT INTO transit_feed (id, publisher, valid_from, valid_to) VALUES (%(id)s, %(publisher)s,"
            " %(valid_from)s, %(valid_to)s)",
            doc["feed"],
        )
        cur.executemany(
            "INSERT INTO transit_stops VALUES (%(stop_id)s, %(name)s,"
            " ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326), %(wheelchair_boarding)s)",
            doc["stops"],
        )
        cur.executemany(
            "INSERT INTO transit_routes VALUES (%(route_id)s, %(short_name)s, %(long_name)s, %(route_type)s,"
            " %(color)s)",
            doc["routes"],
        )
        cur.executemany(
            "INSERT INTO transit_trips VALUES (%(trip_id)s, %(route_id)s, %(service_id)s, %(headsign)s,"
            " %(wheelchair_accessible)s, %(shape_id)s)",
            doc["trips"],
        )
        cur.executemany(
            "INSERT INTO transit_stop_times VALUES (%(trip_id)s, %(stop_sequence)s, %(stop_id)s, %(arrival_s)s,"
            " %(departure_s)s, %(shape_dist)s)",
            doc["stop_times"],
        )
        cur.executemany(
            "INSERT INTO transit_shapes VALUES (%(shape_id)s,"
            " ST_SetSRID(ST_GeomFromGeoJSON(%(line)s), 4326), %(length)s)",
            [{**s, "line": json.dumps({"type": "LineString", "coordinates": s["coordinates"]})} for s in doc["shapes"]],
        )
        cur.executemany(
            "INSERT INTO transit_calendar VALUES (%(service_id)s, %(days)s, %(start_date)s, %(end_date)s)",
            doc["calendar"],
        )


@pytest.fixture(scope="session")
def client(migrated, tmp_path_factory):
    from pathable_api.main import create_app
    from pathable_api.settings import Settings

    app = create_app(
        Settings(
            database_url=migrated,
            redis_url=None,
            cors_origins=("http://localhost:3000",),
            routes_per_minute=1000,
            reports_per_minute=1000,
            photo_dir=str(tmp_path_factory.mktemp("photos")),
        )
    )
    with TestClient(app) as c:
        yield c
