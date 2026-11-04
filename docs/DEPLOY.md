# Deploying the demo on free tiers

The demo is deployed without pushing the source to GitHub. Each piece is
uploaded straight from this machine.

## The plan

| Piece | Host (free tier) | Limits that matter | How it gets there |
| --- | --- | --- | --- |
| Web (`apps/web`) | Vercel Hobby | Non-commercial use | `vercel deploy` from the repo root; `.vercelignore` keeps the upload to about 8 MB |
| API (`services/api`) | Render free web service | 512 MB RAM, 0.1 CPU, sleeps after 15 min idle (about 1 min to wake) | Docker image pushed to a **private** registry repo, then pulled by Render |
| Database | Render free Postgres or Neon free (with PostGIS) | About 0.5–1 GB storage; Render's free database expires after 30 days | `alembic upgrade head`, then `export_graph --load` from this machine |

Limits were checked on 2026-11-03 against current free-tier comparisons. They
change often, so re-check them on each provider's pricing page before relying
on them.

## What fits, measured

| Graph | Edges | API worker memory | Database size |
| --- | ---: | ---: | ---: |
| Demo corridor | 6,067 | 125 MB RSS (1 worker, after 5 routes) | 28 MB |
| All of North York | 105,069 | about 596 MB RSS per worker (6 workers, under load) | 113 MB for the whole database with both versions loaded |
| TTC schedule (North York + 1 km) | 4,610 stops, 1.5 M stop times | no extra worker memory (queried in PostGIS) | 229 MB |

Without transit, storage is not the problem: the graph fits a free Postgres
plan. With the full seven-week TTC schedule the database is about 250 MB for the
corridor, which still fits a 0.5 GB free plan but leaves little room; loading
one or two weeks of service instead would cut it to a fraction. API memory is
the harder limit. A 512 MB free instance can serve the corridor with one or two
workers. It cannot hold all of North York in memory, so a free deployment serves the demo
corridor and says so. The North York build needs a paid instance with about
1 GB per worker, or the compact graph described in PERFORMANCE.md. With
0.1 CPU, expect routing to be several times slower than the local benchmark,
and the first request after idle to wait for the instance to wake. The site
labels the live data with its version and says when the service is waking or
unavailable.

## Steps

You run these, signed in to your own accounts:

1. `vercel login`, then from the repository root:
   `vercel deploy --prod`. Set the root directory to `apps/web` and set
   `NEXT_PUBLIC_PATHABLE_API_URL` to the API's URL.
2. Create the database, then load it from this machine:
   ```bash
   cd services/api && DATABASE_URL=<url> uv run alembic upgrade head
   cd ../../pipelines && uv run python -m pathable_pipelines.export_graph --area corridor --load <url>
   ```
3. Build and push the API image to a private registry repository, then create
   the Render web service from that image with these environment variables:
   - `DATABASE_URL`
   - `CORS_ORIGINS=https://<your-vercel-domain>`
   - `WEB_CONCURRENCY=1`
   - `TRUSTED_PROXY_HOPS=1`: Render puts one proxy in front of the service. With
     the default of 0 every request would count against the proxy's address,
     so all visitors would share one rate limit.
   - `REDIS_URL`, if a free Redis is attached; without it the limit is counted
     per process, which is right for one instance.
   - Optional: `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` for
     a hosted trace collector. Unset, tracing costs nothing.
   - Photo upload stays off unless `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`
     and `S3_SECRET_KEY` name a private bucket.

## Not done yet

Nothing is deployed. Every step above needs your sign-in, and nothing is
published without your go-ahead.
