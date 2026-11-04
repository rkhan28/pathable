"""Route cache: reused only when nothing that shaped the answer has changed."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from pathable_api.cache import RouteCache, route_key

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads((ROOT / "contracts/fixtures/routes/york-u-finch-west.json").read_text())
PREFS = json.loads((ROOT / "contracts/fixtures/default-preferences.json").read_text())
TRIP = {"origin": FIXTURE["trip"]["origin"], "destination": FIXTURE["trip"]["destination"], "preferences": PREFS}


def test_identical_requests_are_served_from_the_cache(client):
    trip = {**TRIP, "preferences": {**PREFS, "minWidthM": 1.13}}  # a preference set no other test uses
    first = client.post("/v1/routes", json=trip)
    second = client.post("/v1/routes", json=trip)
    assert first.headers["x-cache"] == "miss"
    assert second.headers["x-cache"] == "hit"
    assert second.json()["routes"] == first.json()["routes"]
    other = client.post("/v1/routes", json={**trip, "preferences": {**trip["preferences"], "avoidStairs": False}})
    assert other.headers["x-cache"] == "miss"  # any preference is part of the key


def test_a_new_report_is_never_answered_from_before_it_existed(client):
    trip = {**TRIP, "preferences": {**PREFS, "minWidthM": 1.17}}
    assert client.post("/v1/routes", json=trip).headers["x-cache"] == "miss"
    assert client.post("/v1/routes", json=trip).headers["x-cache"] == "hit"
    receipt = client.post(
        "/v1/reports",
        json={
            "kind": "obstacle",
            "location": TRIP["origin"],
            "description": "",
            "photoId": None,
            "observedOn": date.today().isoformat(),
        },
    ).json()
    try:
        assert client.post("/v1/routes", json=trip).headers["x-cache"] == "miss"
    finally:
        client.post(f"/v1/reports/{receipt['id']}/withdraw", json={"withdrawToken": receipt["withdrawToken"]})
    # With the report gone, the trip is exactly what it was, and the earlier answer is right again.
    assert client.post("/v1/routes", json=trip).headers["x-cache"] == "hit"


def test_the_key_covers_version_ends_preferences_and_reports():
    base = route_key("v1", [-79.5, 43.77], [-79.49, 43.76], PREFS, [])
    assert route_key("v1", [-79.5, 43.77], [-79.49, 43.76], dict(reversed(PREFS.items())), []) == base
    assert route_key("v2", [-79.5, 43.77], [-79.49, 43.76], PREFS, []) != base
    assert route_key("v1", [-79.49, 43.76], [-79.5, 43.77], PREFS, []) != base
    assert route_key("v1", [-79.5, 43.77], [-79.49, 43.76], PREFS, [{"id": "r1", "status": "reported"}]) != base
    verified = route_key("v1", [-79.5, 43.77], [-79.49, 43.76], PREFS, [{"id": "r1", "status": "verified"}])
    assert verified != route_key("v1", [-79.5, 43.77], [-79.49, 43.76], PREFS, [{"id": "r1", "status": "reported"}])


def test_off_and_down_are_both_just_misses():
    off = RouteCache(None, 0)
    off.put("k", [{"id": "a"}])
    assert off.get("k") is None
    down = RouteCache("redis://127.0.0.1:1/0", 600)  # nothing listens there
    down.put("k", [{"id": "a"}])
    assert down.get("k") is None


def test_local_cache_is_bounded():
    from pathable_api import cache

    local = RouteCache(None, 600)
    for i in range(cache.LOCAL_ENTRIES + 10):
        local.put(f"k{i}", [{"i": i}])
    assert local.get("k0") is None
    assert local.get(f"k{cache.LOCAL_ENTRIES + 9}") == [{"i": cache.LOCAL_ENTRIES + 9}]


def test_redis_cache_is_shared_and_expires():
    ttl = 600
    from testcontainers.community.redis import RedisContainer

    with RedisContainer("redis:7.4-alpine") as redis:
        url = f"redis://{redis.get_container_host_ip()}:{redis.get_exposed_port(6379)}/0"
        RouteCache(url, ttl).put("routes:k", [{"id": "a"}])
        assert RouteCache(url, ttl).get("routes:k") == [{"id": "a"}]  # another worker sees it
        assert 0 < redis.get_client().ttl("routes:k") <= ttl
