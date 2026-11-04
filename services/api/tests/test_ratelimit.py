"""Rate limiting: who a request counts against, the 429 it returns, and Redis."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pathable_api.ratelimit import RateLimited, RateLimiter, client_address


@pytest.mark.parametrize(
    ("header", "hops", "expected"),
    [
        (None, 0, "10.0.0.9"),
        ("6.6.6.6", 0, "10.0.0.9"),  # no proxy trusted: the header is ignored, so it cannot be spoofed
        ("6.6.6.6, 203.0.113.5", 1, "203.0.113.5"),  # the client typed 6.6.6.6; our proxy appended the rest
        ("203.0.113.5", 1, "203.0.113.5"),
        ("6.6.6.6, 203.0.113.5, 10.1.1.1", 2, "203.0.113.5"),
        ("203.0.113.5", 2, "10.0.0.9"),  # fewer entries than proxies: something is off, use the peer
    ],
)
def test_client_address_believes_only_trusted_proxies(header, hops, expected):
    assert client_address(header, "10.0.0.9", hops) == expected


def test_limit_says_when_to_retry():
    limiter = RateLimiter(None)
    for _ in range(3):
        limiter.check("routes", "a", 3)
    with pytest.raises(RateLimited) as caught:
        limiter.check("routes", "a", 3)
    assert 1 <= int(caught.value.headers["Retry-After"]) <= 61
    limiter.check("routes", "b", 3)  # another client has its own budget


def test_redis_down_counts_locally_instead_of_failing():
    limiter = RateLimiter("redis://127.0.0.1:1/0")  # nothing listens on port 1
    for _ in range(2):
        limiter.check("routes", "a", 2)
    with pytest.raises(RateLimited):
        limiter.check("routes", "a", 2)


def test_redis_is_shared_between_instances():
    from testcontainers.community.redis import RedisContainer

    with RedisContainer("redis:7.4-alpine") as redis:
        url = f"redis://{redis.get_container_host_ip()}:{redis.get_exposed_port(6379)}/0"
        first, second = RateLimiter(url), RateLimiter(url)
        first.check("routes", "a", 2)
        second.check("routes", "a", 2)
        with pytest.raises(RateLimited):
            first.check("routes", "a", 2)  # the third request, wherever it lands
        ttl = redis.get_client().ttl(next(iter(redis.get_client().scan_iter("rl:routes:a:*"))))
        assert 0 < ttl <= 120


def test_a_429_over_http_has_the_contract_shape_and_retry_after(migrated, tmp_path):
    from pathable_api.main import create_app
    from pathable_api.settings import Settings

    app = create_app(Settings(database_url=migrated, redis_url=None, hazards_per_minute=1, photo_dir=str(tmp_path)))
    with TestClient(app) as c:
        bbox = {"bbox": "-79.50,43.76,-79.49,43.77"}
        assert c.get("/v1/hazards", params=bbox).status_code == 200
        res = c.get("/v1/hazards", params=bbox, headers={"x-forwarded-for": "198.51.100.1"})
        assert res.status_code == 429  # a made-up X-Forwarded-For does not buy a fresh budget
        assert res.json()["error"]["code"] == "rate_limited"
        assert res.json()["error"]["retryable"] is True
        assert int(res.headers["retry-after"]) >= 1


def test_framework_errors_use_the_contract_shape(client):
    missing = client.get("/v1/nope")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    wrong_method = client.get("/v1/routes")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["error"]["code"] == "invalid_request"
