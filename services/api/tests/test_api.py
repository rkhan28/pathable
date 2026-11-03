"""API integration tests against real PostGIS. Every 2xx and error response is
validated against contracts/openapi.json, generated from the Zod contract."""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import psycopg
import pytest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]
OPENAPI = json.loads((ROOT / "contracts/openapi.json").read_text())
FIXTURE = json.loads((ROOT / "contracts/fixtures/routes/york-u-finch-west.json").read_text())
PREFS = json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text())
TRIP = {
    "origin": FIXTURE["trip"]["origin"],
    "destination": FIXTURE["trip"]["destination"],
    "preferences": PREFS,
}


def valid(schema: str, body: dict) -> None:
    errors = sorted(Draft202012Validator(OPENAPI["components"]["schemas"][schema]).iter_errors(body), key=str)
    assert not errors, [f"{list(e.path)}: {e.message}" for e in errors[:5]]


def test_health_and_ready(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["dataVersion"] == "test-york-u-finch-west"


def test_routes_match_contract_and_are_live(client):
    res = client.post("/v1/routes", json=TRIP)
    assert res.status_code == 200, res.text
    body = res.json()
    valid("RouteResponse", body)
    assert body["source"] == "live"
    assert 1 <= len(body["routes"]) <= 3
    assert [r["rank"] for r in body["routes"]] == list(range(1, len(body["routes"]) + 1))


def test_live_routes_agree_with_the_fixture(client):
    """Same data, same router: the API and the frozen fixture rank identically."""
    live = client.post("/v1/routes", json=TRIP).json()["routes"]
    frozen = FIXTURE["response"]["routes"]
    key = lambda r: (r["distanceM"], r["score"], r["compatibility"], r["rank"])  # noqa: E731
    assert [key(r) for r in live] == [key(r) for r in frozen]


def test_no_data_is_never_verified(client):
    checked = {"presence", "surface", "width", "running_slope", "kerbs"}
    for route in client.post("/v1/routes", json=TRIP).json()["routes"]:
        for seg in route["segments"]:
            if seg["state"] == "verified":
                assert all(e["value"] is not None for e in seg["evidence"] if e["attribute"] in checked)


def test_preferences_change_the_outcome(client):
    strict = client.post("/v1/routes", json=TRIP | {"preferences": PREFS | {"maxRunningSlopePct": 2}}).json()
    loose = client.post("/v1/routes", json=TRIP | {"preferences": PREFS | {"maxRunningSlopePct": 12}}).json()

    def barrier(r):
        return sum(x["lengthByState"]["barrier"] for x in r["routes"])

    assert barrier(strict) > barrier(loose)


@pytest.mark.parametrize("origin", [[-79.3832, 43.6532], [-79.40, 43.80]], ids=["downtown", "north-york-unbuilt"])
def test_outside_coverage(client, origin):
    res = client.post("/v1/routes", json=TRIP | {"origin": origin})
    assert res.status_code == 422
    valid("ApiError", res.json())
    assert res.json()["error"]["code"] == "outside_coverage"


def test_invalid_request_uses_contract_error(client):
    res = client.post("/v1/routes", json={"origin": [0, 0]})
    assert res.status_code == 400
    valid("ApiError", res.json())
    assert res.json()["error"] == {
        "code": "invalid_request",
        "retryable": False,
        "requestId": res.headers["x-request-id"],
    }


def test_hazards_in_bbox(client):
    lon, lat = FIXTURE["trip"]["origin"]
    res = client.get("/v1/hazards", params={"bbox": f"{lon - 0.02},{lat - 0.02},{lon + 0.02},{lat + 0.02}"})
    assert res.status_code == 200
    valid("HazardsResponse", res.json())
    assert client.get("/v1/hazards", params={"bbox": "-80,43,-79,44"}).status_code == 400


def test_report_lifecycle_is_audited_and_append_only(client, migrated):
    report = {
        "kind": "ice",
        "location": [-79.495, 43.77],
        "description": "Ice across the ramp",
        "photoId": None,
        "observedOn": date.today().isoformat(),
    }
    res = client.post("/v1/reports", json=report)
    assert res.status_code == 201, res.text
    receipt = res.json()
    valid("ReportReceipt", receipt)
    assert receipt["status"] == "received"

    # Winter reports appear as reported hazards and expire after 48 hours.
    lon, lat = report["location"]
    hz = client.get("/v1/hazards", params={"bbox": f"{lon - 0.001},{lat - 0.001},{lon + 0.001},{lat + 0.001}"}).json()[
        "hazards"
    ]
    mine = next(h for h in hz if h["id"] == receipt["id"])
    assert mine["status"] == "reported"
    assert mine["expiresAt"] is not None

    withdrawn = client.post(f"/v1/reports/{receipt['id']}/withdraw").json()
    valid("ReportReceipt", withdrawn)
    assert withdrawn["status"] == "withdrawn"
    assert client.post(f"/v1/reports/{receipt['id']}/withdraw").status_code == 400  # withdrawn is final

    with psycopg.connect(migrated) as c:
        events = c.execute(
            "SELECT from_status, to_status FROM report_events WHERE report_id = %s ORDER BY id",
            (receipt["id"],),
        ).fetchall()
        assert events == [(None, "received"), ("received", "withdrawn")]
        with pytest.raises(psycopg.errors.RaiseException, match="append-only"):
            c.execute("UPDATE report_events SET actor = 'x' WHERE report_id = %s", (receipt["id"],))


def test_moderation_transitions_are_enforced(migrated, client):
    receipt = client.post(
        "/v1/reports",
        json={
            "kind": "obstacle",
            "location": [-79.49, 43.77],
            "description": "",
            "photoId": None,
            "observedOn": date.today().isoformat(),
        },
    ).json()
    with psycopg.connect(migrated, autocommit=True) as c:
        with pytest.raises(psycopg.errors.CheckViolation):
            c.execute(
                "SELECT * FROM transition_report(%s::uuid, 'verified', 'moderator')",
                (receipt["id"],),
            )
        c.execute(
            "SELECT * FROM transition_report(%s::uuid, 'under_review', 'moderator')",
            (receipt["id"],),
        )
        c.execute("SELECT * FROM transition_report(%s::uuid, 'verified', 'moderator')", (receipt["id"],))
        assert c.execute("SELECT status FROM reports WHERE id = %s::uuid", (receipt["id"],)).fetchone()[0] == "verified"


def test_reports_reject_future_dates_and_unknown_ids(client):
    future = (date.today() + timedelta(days=2)).isoformat()
    res = client.post(
        "/v1/reports",
        json={
            "kind": "obstacle",
            "location": [-79.49, 43.77],
            "description": "",
            "photoId": None,
            "observedOn": future,
        },
    )
    assert res.status_code == 400
    assert client.post("/v1/reports/00000000-0000-0000-0000-000000000000/withdraw").status_code == 404
    assert client.post("/v1/reports/not-a-uuid/withdraw").status_code == 404


def test_analysis_is_honestly_unavailable(client):
    res = client.post("/v1/reports/analyze")
    valid("AnalysisResponse", res.json())
    assert res.json() == {"status": "unavailable", "reason": "no_model"}


def test_rate_limit_returns_contract_error():
    from pathable_api.errors import ApiError
    from pathable_api.ratelimit import RateLimiter

    limiter = RateLimiter(None)
    for _ in range(3):
        limiter.check("routes", "1.2.3.4", 3)
    with pytest.raises(ApiError, match="rate_limited"):
        limiter.check("routes", "1.2.3.4", 3)


def test_concurrent_preferences_do_not_interfere(client):
    """Routing with different preferences at the same time must give the same answers as one at a time."""
    from concurrent.futures import ThreadPoolExecutor

    variants = [PREFS | {"maxRunningSlopePct": s} for s in (2, 5, 8, 12)]

    def ask(p):
        return [r["score"] for r in client.post("/v1/routes", json=TRIP | {"preferences": p}).json()["routes"]]

    alone = [ask(p) for p in variants]
    with ThreadPoolExecutor(8) as pool:
        together = list(pool.map(ask, variants * 3))
    assert together == alone * 3


def test_a_second_data_version_with_the_same_edge_ids_loads(migrated):
    """Graph builds reuse edge ids; versions must coexist so a new build can be loaded beside the live one."""
    from pathable_api.db import load_graph

    doc = json.loads((ROOT / "contracts/fixtures/graph-york-u-finch-west.json").read_text())
    hazards = doc["hazards"][:2]
    keep = {h["edge_id"] for h in hazards}
    edges = [e for e in doc["edges"] if e["id"] in keep] + [e for e in doc["edges"] if e["id"] not in keep][
        : 50 - len(keep)
    ]
    load_graph(migrated, "test-second-build", doc["coverage_wkt"], edges, hazards, notes="test")
    with psycopg.connect(migrated) as c:
        counts = dict(c.execute("SELECT data_version, count(*) FROM edges GROUP BY 1").fetchall())
        assert counts["test-second-build"] == 50
        assert counts["test-york-u-finch-west"] == len(doc["edges"])
        c.execute("DELETE FROM data_versions WHERE id = 'test-second-build'")


def test_open_reports_are_avoided_or_shown(client):
    """With "avoid reported obstacles" on, routes go around a reported spot; with it off,
    the route that passes it carries the report and says so."""
    off = TRIP | {"preferences": PREFS | {"avoidReportedObstacles": False}}
    base = client.post("/v1/routes", json=off).json()["routes"][0]
    seg = next(s for s in base["segments"] if s["kind"] == "sidewalk" and s["lengthM"] > 20)
    (ax, ay), (bx, by) = base["geometry"][seg["from"]], base["geometry"][seg["to"]]
    mid = [(ax + bx) / 2, (ay + by) / 2]
    receipt = client.post(
        "/v1/reports",
        json={
            "kind": "obstacle",
            "location": mid,
            "description": "",
            "photoId": None,
            "observedOn": date.today().isoformat(),
        },
    ).json()
    try:
        shown = client.post("/v1/routes", json=off).json()["routes"]
        carrying = [r for r in shown if any(h["id"] == receipt["id"] for h in r["hazards"])]
        assert carrying, "with avoidance off, the route through the report should carry it"
        for r in carrying:
            h = next(h for h in r["hazards"] if h["id"] == receipt["id"])
            assert h["status"] == "reported"
            assert h["source"] == "community-report"
            assert any(reason["code"] == "reported_hazards" for reason in r["reasons"])

        avoided = client.post("/v1/routes", json=TRIP).json()["routes"]
        best = avoided[0]
        on_best = [h for h in best["hazards"] if h["id"] == receipt["id"]]
        # Either the best route now goes around it, or, if it cannot, the stretch is marked reported.
        if on_best:
            assert next(s for s in best["segments"] if s["id"] == on_best[0]["segmentId"])["state"] in (
                "unverified",
                "barrier",
            )
        else:
            assert best["geometry"] != base["geometry"]
    finally:
        client.post(f"/v1/reports/{receipt['id']}/withdraw")
    after = client.post("/v1/routes", json=off).json()["routes"]
    assert all(h["id"] != receipt["id"] for r in after for h in r["hazards"])


def _jpeg_with_gps() -> bytes:
    import io

    from PIL import Image

    img = Image.new("RGB", (2400, 1200), (120, 140, 130))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x8825] = {1: "N", 2: (43.0, 46.0, 30.0), 3: "W", 4: (79.0, 29.0, 50.0)}  # GPS
    out = io.BytesIO()
    img.save(out, "JPEG", exif=exif)
    return out.getvalue()


def test_photo_upload_strips_metadata_and_stores_privately(client):
    from PIL import Image

    raw = _jpeg_with_gps()
    assert b"Exif" in raw[:200]
    res = client.post("/v1/photos", files={"photo": ("ramp.jpg", raw, "image/jpeg")})
    assert res.status_code == 201, res.text
    valid("PhotoReceipt", res.json())
    stored = client.app.state.pathable.photos.root / f"{res.json()['photoId']}.jpg"
    data = stored.read_bytes()
    assert b"Exif" not in data and b"PhoneMaker" not in data
    with Image.open(stored) as img:
        assert max(img.size) == 1600
        assert not img.getexif()

    report = {
        "kind": "obstacle",
        "location": [-79.49, 43.77],
        "description": "",
        "photoId": res.json()["photoId"],
        "observedOn": date.today().isoformat(),
    }
    receipt = client.post("/v1/reports", json=report)
    assert receipt.status_code == 201
    client.post(f"/v1/reports/{receipt.json()['id']}/withdraw")


def test_photo_upload_rejects_non_images_and_bad_ids(client):
    assert client.post("/v1/photos", files={"photo": ("x.jpg", b"not an image", "image/jpeg")}).status_code == 400
    bad = {
        "kind": "obstacle",
        "location": [-79.49, 43.77],
        "description": "",
        "photoId": "../../etc/passwd",
        "observedOn": date.today().isoformat(),
    }
    assert client.post("/v1/reports", json=bad).status_code == 400
