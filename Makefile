# PathAble. `make up` starts the whole stack; `make check` runs every gate.
COMPOSE := docker compose -f infra/compose.yaml
DB_URL  := postgresql://pathable:pathable@localhost:5432/pathable
AREA    ?= corridor
# Testcontainers mounts the Docker socket into its helper container; this is the
# path inside the VM for both Docker Desktop and Colima.
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ?= /var/run/docker.sock

.PHONY: up down data load fixtures contracts check check-web check-api check-pipelines e2e bench screenshots trace

up:            ## Start PostGIS, Redis, S3, API and web
	$(COMPOSE) up -d --build --wait db redis s3
	cd services/api && DATABASE_URL=$(DB_URL) uv run alembic upgrade head
	$(MAKE) load
	$(COMPOSE) up -d --build api web
	@echo "web: http://localhost:3000  api: http://localhost:8000/readyz"

down:
	$(COMPOSE) down

trace:         ## Start Jaeger and send the API's traces to it (UI on http://localhost:16686)
	$(COMPOSE) --profile tracing up -d jaeger
	OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 $(COMPOSE) up -d api
	@echo "traces: http://localhost:16686 (service pathable-api)"

data:          ## Download sources (Toronto Open Data, Geofabrik) and clip OSM to North York
	cd pipelines && uv run python -m pathable_pipelines.fetch
	curl -L -C - -o data/raw/osm/ontario-latest.osm.pbf https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf
	osmium extract -p data/raw/osm/north_york.geojson -s smart -O -o data/raw/osm/north_york.osm.pbf data/raw/osm/ontario-latest.osm.pbf

load:          ## Build the evidence graph for $(AREA) and load it, plus the TTC schedule, into PostGIS
	cd pipelines && uv run python -m pathable_pipelines.export_graph --area $(AREA) --load $(DB_URL)
	cd pipelines && uv run python -m pathable_pipelines.transit --load $(DB_URL)

fixtures:      ## Recompute development fixtures and the reality check
	cd pipelines && uv run python -m pathable_pipelines.reality_check && uv run python -m pathable_pipelines.demo_fixtures

contracts:     ## Regenerate contracts/openapi.json and scoring cases from their sources
	cd apps/web && npm run contracts
	cd services/api && uv run python scripts/build_scoring_cases.py

check: check-web check-api check-pipelines

check-web:
	cd apps/web && npm run check

check-api:
	cd services/api && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

check-pipelines:
	cd pipelines && uv run ruff check . && uv run pytest -q

e2e:
	cd apps/web && NEXT_PUBLIC_DEV_FIXTURES=true npm run build && npx playwright test

bench:         ## k6 latency benchmark: lifts the API's rate limits for the run, saves the summary
	ROUTES_PER_MINUTE=1000000 HAZARDS_PER_MINUTE=1000000 $(COMPOSE) up -d --wait api
	k6 run --summary-export docs/data/k6-summary.json infra/k6/routes.js; status=$$?; \
	$(COMPOSE) up -d --wait api; exit $$status

screenshots:
	cd apps/web && node scripts/screenshots.mjs http://localhost:3100 ../../docs/screenshots latest
