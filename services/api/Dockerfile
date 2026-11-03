# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.5.29 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev
RUN useradd --system --uid 10001 app && chown -R app /app
# Run from the virtualenv directly; `uv run` would need a writable cache at runtime.
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"
# Routing is CPU-bound Python; keep workers above expected concurrent route requests (docs/PERFORMANCE.md).
ENV WEB_CONCURRENCY=4
CMD ["sh", "-c", "alembic upgrade head && uvicorn pathable_api.main:app --host 0.0.0.0 --port 8000 --workers $WEB_CONCURRENCY"]
