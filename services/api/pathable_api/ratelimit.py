"""Fixed-window rate limiting: Redis when configured, in-process otherwise (single instance only)."""

import time
from collections import defaultdict

from .errors import ApiError


class RateLimiter:
    def __init__(self, redis_url: str | None):
        self._redis = None
        if redis_url:
            import redis

            self._redis = redis.Redis.from_url(redis_url)
        self._local: dict[str, int] = defaultdict(int)

    def check(self, bucket: str, client: str, per_minute: int) -> None:
        window = int(time.time() // 60)
        key = f"rl:{bucket}:{client}:{window}"
        if self._redis is not None:
            count = self._redis.incr(key)
            if count == 1:
                self._redis.expire(key, 120)
        else:
            self._local[key] += 1
            count = self._local[key]
        if count > per_minute:
            raise ApiError("rate_limited")
