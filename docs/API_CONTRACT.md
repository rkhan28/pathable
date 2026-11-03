# API contract

- **Source of truth:** `apps/web/src/lib/api/contracts.ts` (Zod).
- **Generated file:** `contracts/openapi.json` (OpenAPI 3.1), via
  `npm run contracts`. Don't edit it by hand; CI fails if it is stale.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| POST | `/v1/routes` | 200 `RouteResponse`: 1–3 ranked alternatives | 400 `invalid_request`, 404 `no_route`, 422 `outside_coverage`, 429 `rate_limited`, 503 `unavailable` |
| GET | `/v1/hazards?bbox=w,s,e,n` | 200 `HazardsResponse`: unexpired measured hazards plus open reports | 400 if the bbox is invalid or larger than about 0.05 deg² |
| POST | `/v1/reports` | 201 `ReportReceipt` (`received`) | 400, 422 `outside_coverage`, 429 |
| POST | `/v1/reports/{id}/withdraw` | 200 `ReportReceipt` (`withdrawn`) | 404 if unknown, 400 if the transition is not allowed |
| POST | `/v1/reports/analyze` | 200 `{"status":"unavailable","reason":"no_model"}` | — |
| GET | `/healthz`, `/readyz` | liveness; readiness plus `dataVersion` | 503 until a graph is loaded |

**Errors** always have this shape:

```json
{"error": {"code": "...", "retryable": true, "requestId": "..."}}
```

The client renders the message from `code`, in the interface language.

**Moderation** follows these states:

```
received ──► under_review ──► verified | rejected
   │               │              │
   └──► withdrawn ◄┴──────────────┘
```

- Status changes go through the SQL function `transition_report`, which checks
  the transition table and writes an append-only `report_events` row in the
  same transaction.
- Snow, ice and blocked-ramp reports expire 48 hours after they are received.
