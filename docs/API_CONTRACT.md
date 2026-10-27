# PathAble API contract (v1)

The executable source of truth is [`src/api/contracts.ts`](../src/api/contracts.ts): Zod schemas the frontend uses to validate every response. This document explains the intent so the backend can be built against it.

Base URL: `NEXT_PUBLIC_PATHABLE_API_URL` (e.g. `https://api.pathable.ca`). All bodies are JSON unless noted. Timestamps are ISO 8601 with offset.

## Principles

1. **Codes, not prose.** Maneuvers, recommendation reasons, step notes and quality issues are enumerations. The client renders them in the person's language and for voice guidance.
2. **Four knowledge states, never merged:** `verified_accessible`, `known_barrier`, `reported_unverified`, `unknown`. `unknown` must never be returned as accessible.
3. **Provenance everywhere.** Every segment and hazard carries a `source` and an observation time. Responses carry `source: "live" | "development-fixture"`.
4. **Fail loudly.** If a response doesn't match the schema, the client shows an error rather than partial data.

## `POST /v1/routes`

Request:

```jsonc
{
  "origin": { "lat": 43.6453, "lng": -79.3806 },
  "destination": { "lat": 43.6487, "lng": -79.3715 },
  "preferences": {
    "profile": "manual_wheelchair",      // starting point only; flags below are authoritative
    "maxSlopePercent": 5,                // null = no limit
    "minWidthCm": 92,                    // null = no requirement
    "avoidStairs": true,
    "avoidSteepCurbs": true,
    "avoidDamagedSurfaces": true,
    "avoidReportedObstacles": true,
    "avoidNarrowPassages": true,
    "preferVerifiedRoutes": true,
    "preferShorterRoutes": false
  },
  "departAt": "2026-10-27T09:00:00-04:00", // seasonal/hazard context only
  "alternatives": 3
}
```

Response (abridged — see `RoutesResponseSchema`):

```jsonc
{
  "requestId": "r_123",
  "source": "live",
  "generatedAt": "…",
  "coverage": { "status": "covered" | "partial" | "outside", "region": "Toronto" },
  "routes": [{
    "id": "rt_1",
    "geometry": { "type": "LineString", "coordinates": [[-79.38, 43.64], …] },
    "summary": {
      "distanceMeters": 960, "durationSeconds": 960,
      "coverage": { "verified_accessible": 0.69, "known_barrier": 0, "reported_unverified": 0.12, "unknown": 0.19 },
      "knownBarrierCount": 0, "unverifiedReportCount": 1,
      "oldestObservationAt": "…", "newestObservationAt": "…"
    },
    "compatibility": { "level": "meets" | "partial" | "conflicts" | "insufficient_data", "conflicts": [{ "preference": "avoidStairs", "segmentIds": ["s3"] }] },
    "recommendation": { "rank": 1, "reasons": ["fewest_known_barriers", "highest_verified_coverage"] },
    "segments": [{ "id": "s1", "startIndex": 0, "endIndex": 7, "status": "verified_accessible", "lengthMeters": 160,
                   "maxSlopePercent": 1.6, "minWidthCm": 170, "surface": "smooth", "source": "field_survey",
                   "observedAt": "…", "hazardIds": [] }],
    "hazards": [ /* Hazard */ ],
    "steps": [{ "maneuver": { "type": "turn", "modifier": "left" }, "streetName": "Front St W",
                "distanceMeters": 120, "location": { … }, "notes": ["curb_ramp_both_sides"] }]
  }]
}
```

Rules the client relies on:

- `segments` cover the whole geometry contiguously; `startIndex`/`endIndex` index into `geometry.coordinates` (inclusive).
- `summary.coverage` values sum to ~1 and are length-weighted.
- `recommendation.rank` is 1..n with no gaps; `reasons` explain rank 1 relative to the alternatives (see [ROUTE_RANKING.md](ROUTE_RANKING.md)).
- `compatibility.level` is `meets` only if there are no known conflicts. It says nothing about unknown sections — the UI adds that caveat itself.

## `GET /v1/hazards?bbox=west,south,east,north`

Returns `{ source, generatedAt, hazards: Hazard[] }` for the visible map area. Clients hide hazards past `expiresAt`. Return an empty list (not an error) when zoomed far out.

`Hazard`: `id`, `type` (`stairs`, `missing_curb_ramp`, `blocked_curb_ramp`, `steep_slope`, `damaged_surface`, `narrow_passage`, `construction`, `obstruction`, `snow_blocked`, `ice`, `flooding`, `other`), `location`, `status` (`verified` | `reported` | `resolved`), `severity` (`blocking` | `caution`), `source`, `reportedAt`, `verifiedAt`, `expiresAt`, `confirmations`, `description`.

## `POST /v1/reports/analyze` (multipart)

Form field `image` (JPEG, EXIF already stripped by the client, ≤ 2048 px). Response:

```jsonc
{
  "analysisId": "a_123",
  "model": { "name": "sidewalk-hazards", "version": "2026.10" },
  "processedAt": "…",
  "detections": [{ "id": "d1", "label": "blocked_curb_ramp", "confidence": 0.82,
                   "box": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4 } }],  // normalised 0..1
  "qualityIssues": ["image_too_dark"]
}
```

The client draws boxes exactly as returned and never invents any. If this endpoint is unavailable, the UI says so and reporting continues manually.

## `POST /v1/reports`

Body: `ReportSubmission` — `hazardType`, `location`, `locationLabel`, `severity`, `description` (≤ 500), `observedAt`, `temporary`, and `analysis` (`analysisId`, `acceptedDetectionIds`, `rejectedDetectionIds`, `correctedByUser`) or `null`. Returns a `ReportReceipt` (`id`, `status`, `createdAt`). The accepted/rejected IDs are the human review signal for model evaluation.

## `POST /v1/reports/{id}/withdraw`

Returns the updated `ReportReceipt` with `status: "withdrawn"`.

## Errors

Any non-2xx response should use:

```json
{ "error": { "code": "outside_coverage", "message": "…", "retryAfterSeconds": null } }
```

Codes: `invalid_request`, `outside_coverage`, `no_route_found`, `rate_limited`, `unavailable`, `image_rejected`, `internal`. The client adds `network`, `timeout`, `contract_mismatch`, `backend_not_configured`, `aborted`. Each code has a translated, actionable message; `network`, `timeout`, `rate_limited`, `unavailable` and `internal` offer "Try again".
