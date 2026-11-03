"""PathAble API. Implements contracts/openapi.json (generated from the web app's Zod contract)."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated

import psycopg
from fastapi import FastAPI, File, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from . import errors
from .db import Database
from .errors import ApiError
from .models import ReportCreate, RouteRequest
from .photos import MAX_BYTES, InvalidPhoto, LocalStorage, S3Storage, clean_jpeg
from .ratelimit import RateLimiter
from .routing import EvidenceGraph
from .settings import Settings

log = logging.getLogger("pathable.api")
NORTH_YORK_BBOX = (-79.5853, 43.6929, -79.2991, 43.8157)


class State:
    db: Database
    graph: EvidenceGraph | None = None
    version: str | None = None
    limiter: RateLimiter
    photos: LocalStorage | S3Storage | None = None


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    state = State()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        state.db = Database(settings.database_url)
        state.limiter = RateLimiter(settings.redis_url)
        if settings.s3_bucket:
            state.photos = S3Storage(
                settings.s3_endpoint, settings.s3_bucket, settings.s3_access_key, settings.s3_secret_key
            )
        elif settings.photo_dir:
            state.photos = LocalStorage(settings.photo_dir)
        latest = state.db.latest_version()
        if latest:
            started = time.perf_counter()
            state.graph = EvidenceGraph(state.db.pieces(latest["id"]))
            state.version = latest["id"]
            log.info(
                "loaded graph %s: %d edges in %.1fs",
                latest["id"],
                len(state.graph.pieces),
                time.perf_counter() - started,
            )
        yield
        state.db.close()

    app = FastAPI(title="PathAble API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )
    errors.install(app)
    app.state.pathable = state

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        started = time.perf_counter()
        response: Response = await call_next(request)
        response.headers["x-request-id"] = request.state.request_id
        response.headers["server-timing"] = f"app;dur={(time.perf_counter() - started) * 1000:.1f}"
        return response

    def client(request: Request) -> str:
        return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz():
        try:
            ready = state.graph is not None and state.db.ready()
        except psycopg.Error:
            ready = False
        if not ready:
            return JSONResponse({"status": "not_ready"}, status_code=503)
        return {"status": "ready", "dataVersion": state.version}

    @app.post("/v1/routes")
    async def routes(body: RouteRequest, request: Request):
        state.limiter.check("routes", client(request), settings.routes_per_minute)
        if state.graph is None or state.version is None:
            raise ApiError("unavailable")
        for lon, lat in (body.origin, body.destination):
            w, s, e, n = NORTH_YORK_BBOX
            if not (w <= lon <= e and s <= lat <= n) or not state.db.in_coverage(state.version, lon, lat):
                raise ApiError("outside_coverage")
        prefs = body.preferences.model_dump()
        (ox, oy), (dx, dy) = body.origin, body.destination
        margin = 0.02  # about 2 km: alternatives can stray beyond the straight line
        reports = state.db.open_reports(
            (min(ox, dx) - margin, min(oy, dy) - margin, max(ox, dx) + margin, max(oy, dy) + margin)
        )
        result = await run_in_threadpool(state.graph.route, tuple(body.origin), tuple(body.destination), prefs, reports)
        if not result:
            raise ApiError("no_route")
        return {
            "source": "live",
            "dataVersion": state.version,
            "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "routes": result,
        }

    @app.get("/v1/hazards")
    def hazards(bbox: str = Query(pattern=r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$")):
        w, s, e, n = (float(v) for v in bbox.split(","))
        if not (w < e and s < n) or (e - w) * (n - s) > 0.05:
            raise ApiError("invalid_request")
        return {
            "source": "live",
            "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "hazards": state.db.hazards_in((w, s, e, n)),
        }

    @app.post("/v1/reports", status_code=201)
    def create_report(body: ReportCreate, request: Request):
        state.limiter.check("reports", client(request), settings.reports_per_minute)
        lon, lat = body.location
        w, s, e, n = NORTH_YORK_BBOX
        if not (w <= lon <= e and s <= lat <= n):
            raise ApiError("outside_coverage")
        try:
            return state.db.create_report(body.kind, lon, lat, body.description.strip(), body.photoId, body.observedOn)
        except psycopg.errors.CheckViolation as exc:
            raise ApiError("invalid_request") from exc

    @app.post("/v1/photos", status_code=201)
    async def upload_photo(request: Request, photo: Annotated[UploadFile, File()]):
        # Its own budget: a report with a photo should not cost two reports.
        state.limiter.check("photos", client(request), settings.reports_per_minute)
        if state.photos is None:
            raise ApiError("unavailable")
        data = await photo.read(MAX_BYTES + 1)
        try:
            cleaned = await run_in_threadpool(clean_jpeg, data)
        except InvalidPhoto as exc:
            raise ApiError("invalid_request") from exc
        return {"photoId": await run_in_threadpool(state.photos.put, cleaned)}

    @app.post("/v1/reports/{report_id}/withdraw")
    def withdraw(report_id: str):
        try:
            uuid.UUID(report_id)
            return state.db.transition(report_id, "withdrawn", "reporter")
        except ValueError as exc:
            raise ApiError("not_found") from exc
        except psycopg.errors.NoDataFound as exc:
            raise ApiError("not_found") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ApiError("invalid_request") from exc

    @app.post("/v1/reports/analyze")
    def analyze():
        # No model has passed the evaluation in docs/ML_PLAN.md, so analysis is honestly unavailable.
        return {"status": "unavailable", "reason": "no_model"}

    return app


app = create_app()
