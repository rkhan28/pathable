"""Fixed-window rate limiting: Redis when configured, in-process otherwise (single instance only)."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from .errors import ApiError

log = logging.getLogger("pathable.api")
WINDOW_S = 60


class RateLimited(ApiError):
    """A 429 that tells the client, in Retry-After, when its window resets."""

    def __init__(self, retry_after: int):
        super().__init__("rate_limited")
        self.headers = {"Retry-After": str(retry_after)}


class RateLimiter:
    def __init__(self, redis_url: str | None):
        self._redis = None
        if redis_url:
            import redis

            self._redis = redis.Redis.from_url(redis_url, socket_timeout=0.25, socket_connect_timeout=0.25)
        self._local: dict[str, int] = defaultdict(int)
        self._local_window = 0

    def check(self, bucket: str, client: str, per_minute: int) -> None:
        now = time.time()
        window = int(now // WINDOW_S)
        key = f"rl:{bucket}:{client}:{window}"
        count = self._count_redis(key) if self._redis is not None else None
        if count is None:
            count = self._count_local(key, window)
        if count > per_minute:
            raise RateLimited(retry_after=max(1, int((window + 1) * WINDOW_S - now) + 1))

    def redis_status(self) -> str:
        """Redis as readiness reports it: ok, down, or off when none is configured."""
        if self._redis is None:
            return "off"
        import redis

        try:
            return "ok" if self._redis.ping() else "down"
        except redis.RedisError:
            return "down"

    def _count_redis(self, key: str) -> int | None:
        import redis

        try:
            pipe = self._redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, WINDOW_S * 2, nx=True)
            return int(pipe.execute()[0])
        except redis.RedisError:
            # Redis down: count in this process instead of failing every request. The limit
            # becomes per instance until Redis is back, which is better than no service.
            log.warning("rate limiter: Redis unavailable, counting locally", exc_info=True)
            return None

    def _count_local(self, key: str, window: int) -> int:
        # Keys from earlier windows are dropped, so a long-running process does not grow forever.
        if window != self._local_window:
            self._local.clear()
            self._local_window = window
        self._local[key] += 1
        return self._local[key]


def client_address(forwarded_for: str | None, peer: str | None, trusted_hops: int) -> str:
    """Who to count a request against.

    X-Forwarded-For is written by the client first and each proxy after, so only
    the entries our own proxies appended can be believed. With `trusted_hops`
    proxies in front of the API, the client is the entry that many places from
    the end; anything before it could have been typed by the client. With no
    trusted proxies the header is ignored entirely.
    """
    if trusted_hops > 0 and forwarded_for:
        hops = [h.strip() for h in forwarded_for.split(",") if h.strip()]
        if len(hops) >= trusted_hops:
            return hops[-trusted_hops]
    return peer or "unknown"
