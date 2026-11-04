"""One trace from the browser's request, through the API, to the router and the database."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads((ROOT / "contracts/fixtures/routes/york-u-finch-west.json").read_text())
TRIP = {
    "origin": FIXTURE["trip"]["origin"],
    "destination": FIXTURE["trip"]["destination"],
    "preferences": json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text()),
}

TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
TRACEPARENT = f"00-{TRACE_ID}-00f067aa0ba902b7-01"


def test_a_route_request_continues_the_browsers_trace(migrated, tmp_path):
    from pathable_api.main import create_app
    from pathable_api.settings import Settings

    exporter = InMemorySpanExporter()
    app = create_app(Settings(database_url=migrated, redis_url=None, photo_dir=str(tmp_path)), span_exporter=exporter)
    with TestClient(app) as c:
        res = c.post("/v1/routes", json=TRIP, headers={"traceparent": TRACEPARENT})
        assert res.status_code == 200
        c.get("/healthz")  # probes are not traced

    spans = exporter.get_finished_spans()
    names = {s.name for s in spans}
    assert "router.route" in names
    assert any(s.name.startswith("POST /v1/routes") for s in spans)
    assert not any("healthz" in s.name for s in spans)
    route = next(s for s in spans if s.name == "router.route")
    assert format(route.context.trace_id, "032x") == TRACE_ID  # the browser's trace, not a new one
    assert route.attributes["pathable.routes"] >= 1


def test_without_a_collector_tracing_costs_nothing():
    from opentelemetry import trace

    from pathable_api import telemetry

    class App:  # setup must not touch the app when nothing is configured
        pass

    assert isinstance(telemetry.setup(App()), trace.NoOpTracer)
