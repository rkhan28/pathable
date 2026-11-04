"""Route result cache: Redis when configured, a small in-process LRU otherwise.

Routing is CPU-bound and the same trips are asked for again and again (the
demo trips, a shared link, a person switching back to a profile they tried).
A cached answer is only reused when everything that shaped it is the same:
the data version, both ends, every preference, and the open reports near the
trip. A new or withdrawn report changes the key, so it is never served a
route computed before it existed. Entries expire after a few minutes anyway.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import OrderedDict
from collections.abc import Mapping, Sequence

log = logging.getLogger("pathable.api")
LOCAL_ENTRIES = 256


def route_key(version: str, origin, destination, prefs: Mapping, reports: Sequence[Mapping]) -> str:
    parts = {
        "v": version,
        "o": [round(c, 6) for c in origin],
        "d": [round(c, 6) for c in destination],
        "p": dict(sorted(prefs.items())),
        "r": sorted((r["id"], r["status"]) for r in reports),
    }
    return "routes:" + hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()


class RouteCache:
    def __init__(self, redis_url: str | None, ttl_s: int):
        self.ttl_s = ttl_s
        self._redis = None
        if redis_url and ttl_s > 0:
            import redis

            self._redis = redis.Redis.from_url(redis_url, socket_timeout=0.25, socket_connect_timeout=0.25)
        self._local: OrderedDict[str, str] = OrderedDict()

    def get(self, key: str) -> list[dict] | None:
        if self.ttl_s <= 0:
            return None
        raw = self._redis_call("get", key) if self._redis is not None else self._local.get(key)
        if raw is None:
            return None
        if self._redis is None:
            self._local.move_to_end(key)
        return json.loads(raw)

    def put(self, key: str, routes: list[dict]) -> None:
        if self.ttl_s <= 0:
            return
        raw = json.dumps(routes, separators=(",", ":"))
        if self._redis is not None:
            self._redis_call("set", key, raw, ex=self.ttl_s)
            return
        # Without Redis there is no expiry; the LRU bound keeps memory flat, and a new data
        # version or report changes the key, so stale entries are simply never asked for.
        self._local[key] = raw
        self._local.move_to_end(key)
        while len(self._local) > LOCAL_ENTRIES:
            self._local.popitem(last=False)

    def _redis_call(self, name: str, *args, **kwargs):
        import redis

        try:
            return getattr(self._redis, name)(*args, **kwargs)
        except redis.RedisError:
            # A cache that is down is a cache miss, never an error for the person asking.
            log.warning("route cache: Redis unavailable", exc_info=True)
            return None
