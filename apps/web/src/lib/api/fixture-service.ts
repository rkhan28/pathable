/**
 * Development fixtures: real alternatives computed by pipelines/demo_fixtures.py
 * from the North York graph, frozen as JSON. Every response carries
 * source: "development-fixture" and the UI labels it on every card and step.
 * Loaded lazily so production bundles without fixtures never include them.
 */
import { RouteResponse, type HazardsResponse, type LonLat, type RouteRequest } from "./contracts";
import { PathAbleError } from "./errors";
import type { PathAbleService } from "./service";
import { rankRoutes } from "../scoring";

import { FIXTURE_TRIPS, type FixtureTrip, type FixtureTripId } from "./fixture-trips";

export { FIXTURE_TRIPS };

const loaders: Record<FixtureTripId, () => Promise<{ default: unknown }>> = {
  corridor: () => import("@/generated/fixtures/routes/corridor.json"),
  "york-u-finch-west": () => import("@/generated/fixtures/routes/york-u-finch-west.json"),
  "north-york-centre-sheppard-yonge": () => import("@/generated/fixtures/routes/north-york-centre-sheppard-yonge.json"),
};

const MATCH_RADIUS_M = 400;

function metres(a: LonLat, b: LonLat): number {
  const k = Math.PI / 180;
  const x = (b[0] - a[0]) * k * Math.cos(((a[1] + b[1]) / 2) * k);
  const y = (b[1] - a[1]) * k;
  return Math.hypot(x, y) * 6_371_000;
}

export function matchTrip(origin: LonLat, destination: LonLat): FixtureTripId | null {
  for (const [id, trip] of Object.entries(FIXTURE_TRIPS) as [FixtureTripId, FixtureTrip][]) {
    if (metres(origin, trip.origin) < MATCH_RADIUS_M && metres(destination, trip.destination) < MATCH_RADIUS_M) return id;
  }
  return null;
}

export async function loadFixture(id: FixtureTripId): Promise<RouteResponse> {
  const doc = (await loaders[id]()).default as { response: unknown };
  const parsed = RouteResponse.safeParse(doc.response);
  if (!parsed.success) throw new PathAbleError("contract_mismatch", false);
  return parsed.data;
}

/** Re-apply the person's preferences to fixture evidence with the shared rules. */
export function rerank(response: RouteResponse, request: RouteRequest): RouteResponse {
  const scores = new Map(rankRoutes(response.routes, request.preferences).map((s) => [s.id, s]));
  const routes = response.routes
    .map((r) => {
      const s = scores.get(r.id)!;
      return {
        ...r,
        segments: r.segments.map((seg) => ({ ...seg, state: s.states[seg.id] })),
        lengthByState: s.lengthByState,
        barrierCount: s.barrierCount,
        compatibility: s.compatibility,
        rank: s.rank,
        score: s.score,
        reasons: s.reasons,
      };
    })
    .sort((a, b) => a.rank - b.rank);
  return { ...response, routes };
}

export const fixtureService: PathAbleService = {
  kind: "development-fixture",
  async routes(request) {
    const id = matchTrip(request.origin, request.destination);
    if (!id) throw new PathAbleError("no_route", false);
    return rerank(await loadFixture(id), request);
  },
  async hazards(): Promise<HazardsResponse> {
    // No community reports exist yet; fixtures never invent any.
    return { source: "development-fixture", generatedAt: new Date().toISOString(), hazards: [] };
  },
  createReport: () => Promise.reject(new PathAbleError("unavailable", false)),
  withdrawReport: () => Promise.reject(new PathAbleError("unavailable", false)),
  analyzePhoto: () => Promise.resolve({ status: "unavailable", reason: "no_model" }),
};
