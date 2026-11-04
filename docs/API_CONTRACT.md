# API contract

- **Source of truth:** `apps/web/src/lib/api/contracts.ts` (Zod).
- **Generated file:** `contracts/openapi.json` (OpenAPI 3.1), via
  `npm run contracts`. Don't edit it by hand; CI fails if it is stale.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | `/v1/routes` | 200 `RouteResponse`: 1–3 ranked alternatives | 400 `invalid_request` or `same_place`, 404 `no_route`, 422 `outside_coverage`, 429 `rate_limited`, 503 `unavailable` |
| POST | `/v1/transit` | 200 `TransitResponse`: up to three step-free walk, ride, walk options | as for routes; 503 when no schedule covers the day |
| GET | `/v1/hazards?bbox=w,s,e,n` | 200 `HazardsResponse`: unexpired measured hazards plus open reports | 400 if the bbox is invalid or larger than about 0.05 deg², 429 |
| GET | `/v1/coverage` | 200 `CoverageResponse`: the area this deployment has loaded, its size, bounds and data version | 503 until a graph is loaded |
| POST | `/v1/photos` | 201 `PhotoReceipt`: re-encoded with no metadata, stored privately | 400 if not an image, 429, 503 when storage is off |
| POST | `/v1/reports` | 201 `ReportReceipt` (`received`), with a one-time `withdrawToken` | 400 (including a `photoId` that names no stored photo), 422 `outside_coverage`, 429 |
| POST | `/v1/reports/{id}/withdraw` | 200 `ReportReceipt` (`withdrawn`); body `WithdrawRequest` | 404 if the id is unknown or the token is wrong (the two look the same), 400 if the transition is not allowed or the body is missing, 429 |
| POST | `/v1/reports/analyze` | 200 `{"status":"unavailable","reason":"no_model"}` | 429 |
| GET | `/healthz`, `/readyz` | liveness; readiness plus `dataVersion` and `checks` (database, graph, Redis, photos) | 503 until a graph is loaded |

**Errors** always have this shape, including unknown paths (404 `not_found`)
and wrong methods (405 `invalid_request`):

```json
{"error": {"code": "...", "retryable": true, "requestId": "..."}}
```

- The client renders the message from `code`, in the interface language.
- A 429 carries `Retry-After`, in seconds, until the client's window resets.
- `requestId` is the trace id when the client sent one (see Tracing).

**Rate limits** are per client per minute, counted in Redis (or per process if
Redis is down): routes and transit 60, reports, photos and withdrawals 6,
hazards and analysis 120. The client is the address the connection came from.
`X-Forwarded-For` is believed only for `TRUSTED_PROXY_HOPS` entries from its
end (set it to the number of proxies in front of the API; 0, the default,
ignores the header).

**Withdrawing** needs the token returned when the report was created. Report
ids are public in `/v1/hazards`; the token stays on the reporter's device. The
database keeps only its SHA-256.

**Moderation** follows these states:

```
received ──► under_review ──► verified | rejected
   │               │              │
   └──► withdrawn ◄┴──────────────┘
```

- Status changes go through the SQL function `transition_report`, which checks
  the transition table and writes an append-only `report_events` row in the
  same transaction.
- A trigger refuses any other change to `reports.status`, and `report_events`
  refuses UPDATE, DELETE and TRUNCATE.
- Snow, ice and blocked-ramp reports expire 48 hours after they are received.

**Tracing.** Requests may carry a W3C `traceparent`; the web app sends one with
every call. The API continues that trace (request, SQL queries, and a
`router.route` or `router.transit` span) and exports it over OTLP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set. `make trace` runs Jaeger locally.
