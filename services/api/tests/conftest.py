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
    return database_url


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
