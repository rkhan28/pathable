"""OpenTelemetry tracing: web, then API, then router, as one trace.

The browser starts each API call with a W3C `traceparent` header. The FastAPI
instrumentation continues that trace for the request, psycopg adds a span per
query, and the routing work gets a span of its own, so one trace shows where
a slow route spent its time.

Nothing is exported unless OTEL_EXPORTER_OTLP_ENDPOINT is set (for example to
the Jaeger in `make trace`); without it the tracer is a no-op and costs
nothing. Tests pass their own in-memory exporter.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor, SpanExporter

SERVICE_NAME = "pathable-api"


def setup(app: FastAPI, exporter: SpanExporter | None = None) -> trace.Tracer:
    """Instrument the app and return the tracer for our own spans."""
    if exporter is None and not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return trace.NoOpTracer()

    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor

    provider = TracerProvider(resource=Resource.create({"service.name": SERVICE_NAME}))
    if exporter is None:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        # Batched and sent off the request path; the endpoint comes from the standard OTEL_* variables.
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    else:
        provider.add_span_processor(SimpleSpanProcessor(exporter))
    # The provider is passed explicitly rather than set globally, so each app (and each test) has its own.
    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider, excluded_urls="healthz,readyz")
    psycopg = PsycopgInstrumentor()
    if not psycopg.is_instrumented_by_opentelemetry:
        psycopg.instrument(tracer_provider=provider, enable_commenter=False)
    return provider.get_tracer("pathable.api")
