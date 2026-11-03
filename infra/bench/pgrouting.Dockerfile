# PostGIS plus pgRouting on arm64. The official pgrouting image is amd64-only,
# and benchmarking under emulation would not be a fair latency comparison.
FROM imresamu/postgis:16-3.5
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-pgrouting \
 && rm -rf /var/lib/apt/lists/*
