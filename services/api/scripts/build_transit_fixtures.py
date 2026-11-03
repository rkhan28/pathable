"""Freeze real transit answers for the three demo trips as development fixtures.

Runs the same planner as /v1/transit against a loaded database (graph and TTC
schedule) for Wednesday 4 November 2026 at 08:00, and writes one file per trip
to contracts/fixtures/transit/. The web app's fixture mode shifts the times so
the first departure is a few minutes from now, and labels every option as a
development fixture.

  DATABASE_URL=... uv run python scripts/build_transit_fixtures.py
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from pathable_api.db import Database
from pathable_api.routing import EvidenceGraph
from pathable_api.transit import TransitPlanner

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "fixtures"
REQUESTED_AT = datetime(2026, 11, 4, 13, 0, tzinfo=UTC)  # 08:00 in Toronto


def main() -> None:
    db = Database(os.environ["DATABASE_URL"])
    version = db.latest_version()
    planner = TransitPlanner(db, EvidenceGraph(db.pieces(version["id"])))
    feed = planner.feed()
    prefs = json.loads((FIXTURES / "default-preferences.json").read_text())
    out = FIXTURES / "transit"
    out.mkdir(exist_ok=True)
    for src in sorted((FIXTURES / "routes").glob("*.json")):
        trip = json.loads(src.read_text())["trip"]
        options = planner.plan(tuple(trip["origin"]), tuple(trip["destination"]), prefs, REQUESTED_AT)
        doc = {
            "trip": trip,
            "requestedAt": REQUESTED_AT.isoformat().replace("+00:00", "Z"),
            "response": {
                "source": "development-fixture",
                "feedVersion": feed["id"],
                "generatedAt": REQUESTED_AT.isoformat().replace("+00:00", "Z"),
                "options": options,
            },
        }
        (out / src.name).write_text(json.dumps(doc, separators=(",", ":")) + "\n")
        print(src.stem, [o["durationS"] // 60 for o in options], "min")
    db.close()


if __name__ == "__main__":
    main()
