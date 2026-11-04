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

from . import errors, telemetry
from .db import Database
from .errors import ApiError
from .models import ReportCreate, RouteRequest, TransitRequest, WithdrawRequest
from .photos import MAX_BYTES, InvalidPhoto, LocalStorage, S3Storage, clean_jpeg
from .ratelimit import RateLimiter, client_address
from .routing import EvidenceGraph, metres
from .settings import Settings
from .transit import TransitPlanner

log = logging.getLogger("pathable.api")
NORTH_YORK_BBOX = (-79.5853, 43.6929, -79.2991, 43.8157)
# Closer than this, start and destination are one place: there is no trip to rank.
SAME_PLACE_M = 15.0


class State:
    db: Database
    graph: EvidenceGraph | None = None
    version: str | None = None
    limiter: RateLimiter
    photos: LocalStorage | S3Storage | None = None
    transit: TransitPlanner | None = None


def create_app(settings: Settings | None = None, span_exporter=None) -> FastAPI:
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
            state.transit = TransitPlanner(state.db, state.graph)
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
        # traceparent carries the browser's trace into ours; x-request-id ties an error to its trace.
        allow_headers=["content-type", "traceparent", "x-request-id"],
    )
    errors.install(app)
    app.state.pathable = state
    tracer = telemetry.setup(app, span_exporter)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        started = time.perf_counter()
        response: Response = await call_next(request)
        response.headers["x-request-id"] = request.state.request_id
        response.headers["server-timing"] = f"app;dur={(time.perf_counter() - started) * 1000:.1f}"
        return response

    def client(request: Request) -> str:
        return client_address(
            request.headers.get("x-forwarded-for"),
            request.client.host if request.client else None,
            settings.trusted_proxy_hops,
        )

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz():
        # Ready means routes can be served: the graph is loaded and the database answers.
        # Redis and photo storage are reported but do not fail readiness: rate limiting
        # falls back to counting per process, and only photo uploads need storage.
        try:
            ready = state.graph is not None and state.db.ready()
        except psycopg.Error:
            ready = False
        if not ready:
            return JSONResponse({"status": "not_ready"}, status_code=503)
        photos = "off" if state.photos is None else ("ok" if state.photos.ping() else "down")
        return {
            "status": "ready",
            "dataVersion": state.version,
            "checks": {"database": "ok", "graph": "ok", "redis": state.limiter.redis_status(), "photos": photos},
        }

    @app.post("/v1/routes")
    async def routes(body: RouteRequest, request: Request):
        state.limiter.check("routes", client(request), settings.routes_per_minute)
        if state.graph is None or state.version is None:
            raise ApiError("unavailable")
        for lon, lat in (body.origin, body.destination):
            w, s, e, n = NORTH_YORK_BBOX
            if not (w <= lon <= e and s <= lat <= n) or not state.db.in_coverage(state.version, lon, lat):
                raise ApiError("outside_coverage")
        if metres(tuple(body.origin), tuple(body.destination)) < SAME_PLACE_M:
            raise ApiError("same_place")
        prefs = body.preferences.model_dump()
        (ox, oy), (dx, dy) = body.origin, body.destination
        margin = 0.02  # about 2 km: alternatives can stray beyond the straight line
        reports = state.db.open_reports(
            (min(ox, dx) - margin, min(oy, dy) - margin, max(ox, dx) + margin, max(oy, dy) + margin)
        )
        with tracer.start_as_current_span("router.route") as span:
            result = await run_in_threadpool(
                state.graph.route, tuple(body.origin), tuple(body.destination), prefs, reports
            )
            span.set_attribute("pathable.routes", len(result or []))
            span.set_attribute("pathable.open_reports", len(reports))
        if not result:
            raise ApiError("no_route")
        return {
            "source": "live",
            "dataVersion": state.version,
            "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "routes": result,
        }

    @app.post("/v1/transit")
    async def transit(body: TransitRequest, request: Request):
        state.limiter.check("routes", client(request), settings.routes_per_minute)
        if state.transit is None or state.version is None:
            raise ApiError("unavailable")
        feed = state.transit.feed()
        when = body.departAt or datetime.now(UTC)
        if feed is None or not (feed["valid_from"] <= when.date() <= feed["valid_to"]):
            # No schedule loaded, or the loaded one does not cover this day: say so, never guess times.
            raise ApiError("unavailable")
        for lon, lat in (body.origin, body.destination):
            w, s, e, n = NORTH_YORK_BBOX
            if not (w <= lon <= e and s <= lat <= n) or not state.db.in_coverage(state.version, lon, lat):
                raise ApiError("outside_coverage")
        if metres(tuple(body.origin), tuple(body.destination)) < SAME_PLACE_M:
            raise ApiError("same_place")
        with tracer.start_as_current_span("router.transit") as span:
            options = await run_in_threadpool(
                state.transit.plan, tuple(body.origin), tuple(body.destination), body.preferences.model_dump(), when
            )
            span.set_attribute("pathable.options", len(options))
        return {
            "source": "live",
            "feedVersion": feed["id"],
            "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "options": options,
        }

    @app.get("/v1/coverage")
    def coverage():
        if state.version is None:
            raise ApiError("unavailable")
        return {"source": "live", "dataVersion": state.version, **state.db.coverage(state.version)}

    @app.get("/v1/hazards")
    def hazards(request: Request, bbox: str = Query(pattern=r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$")):
        state.limiter.check("hazards", client(request), settings.hazards_per_minute)
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
        # A photo id must name a photo this service stored, not just look like one.
        if body.photoId is not None and (state.photos is None or not state.photos.exists(body.photoId)):
            raise ApiError("invalid_request")
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
    def withdraw(report_id: str, body: WithdrawRequest, request: Request):
        # Only the reporter can withdraw: report ids are public on the map, the token is not.
        state.limiter.check("withdraw", client(request), settings.reports_per_minute)
        try:
            uuid.UUID(report_id)
            return state.db.withdraw(report_id, body.withdrawToken)
        except ValueError as exc:
            raise ApiError("not_found") from exc
        except psycopg.errors.NoDataFound as exc:
            raise ApiError("not_found") from exc
        except psycopg.errors.CheckViolation as exc:
            raise ApiError("invalid_request") from exc

    @app.post("/v1/reports/analyze")
    def analyze(request: Request):
        state.limiter.check("analyze", client(request), settings.hazards_per_minute)
        # No model has passed the evaluation in docs/ML_PLAN.md, so analysis is honestly unavailable.
        return {"status": "unavailable", "reason": "no_model"}

    return app


app = create_app()
