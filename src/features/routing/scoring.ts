/**
 * Route evaluation against a person's mobility preferences.
 *
 * The production backend owns ranking; this module mirrors the documented
 * rules so that (a) development fixtures produce contract-valid, explainable
 * results and (b) the rules are unit-tested and reviewable in one place.
 *
 * Principles:
 * - Unknown is never treated as accessible. It lowers confidence, it doesn't vanish.
 * - A verified barrier that conflicts with an explicit preference dominates the score.
 * - Explanations are derived from the same numbers used for ranking.
 */
import type {
  Hazard,
  HazardType,
  MobilityPreferences,
  PreferenceConflict,
  RecommendationReason,
  Route,
  RouteSegment,
} from "@/api/contracts";

export type RouteDraft = Omit<Route, "compatibility" | "recommendation">;

/** Which preference a hazard type collides with. */
const HAZARD_PREFERENCE: Partial<Record<HazardType, PreferenceConflict["preference"]>> = {
  stairs: "avoidStairs",
  missing_curb_ramp: "avoidSteepCurbs",
  blocked_curb_ramp: "avoidSteepCurbs",
  damaged_surface: "avoidDamagedSurfaces",
  narrow_passage: "avoidNarrowPassages",
  snow_blocked: "avoidReportedObstacles",
  ice: "avoidReportedObstacles",
  obstruction: "avoidReportedObstacles",
  construction: "avoidReportedObstacles",
  flooding: "avoidReportedObstacles",
};

function hazardConflicts(hazard: Hazard, prefs: MobilityPreferences): PreferenceConflict["preference"] | null {
  if (hazard.status === "resolved") return null;
  const pref = HAZARD_PREFERENCE[hazard.type];
  if (pref && pref !== "maxSlopePercent" && pref !== "minWidthCm" && prefs[pref]) return pref;
  // Any reported (unconfirmed) obstacle conflicts when the person asked to avoid reported obstacles.
  if (hazard.status === "reported" && prefs.avoidReportedObstacles) return "avoidReportedObstacles";
  return null;
}

export function findConflicts(route: RouteDraft, prefs: MobilityPreferences): PreferenceConflict[] {
  const bySegment = new Map<PreferenceConflict["preference"], Set<string>>();
  const add = (pref: PreferenceConflict["preference"], segmentId: string) => {
    if (!bySegment.has(pref)) bySegment.set(pref, new Set());
    bySegment.get(pref)!.add(segmentId);
  };
  const hazardsById = new Map(route.hazards.map((h) => [h.id, h]));

  for (const segment of route.segments) {
    if (prefs.maxSlopePercent !== null && segment.maxSlopePercent !== null && segment.maxSlopePercent > prefs.maxSlopePercent) {
      add("maxSlopePercent", segment.id);
    }
    if (prefs.minWidthCm !== null && segment.minWidthCm !== null && segment.minWidthCm < prefs.minWidthCm) {
      add("minWidthCm", segment.id);
    }
    if (prefs.avoidDamagedSurfaces && segment.surface === "damaged") add("avoidDamagedSurfaces", segment.id);
    for (const id of segment.hazardIds) {
      const hazard = hazardsById.get(id);
      if (!hazard) continue;
      const pref = hazardConflicts(hazard, prefs);
      if (pref) add(pref, segment.id);
    }
  }
  return [...bySegment.entries()].map(([preference, ids]) => ({ preference, segmentIds: [...ids] }));
}

export function compatibilityLevel(route: RouteDraft, conflicts: PreferenceConflict[]): Route["compatibility"]["level"] {
  const segById = new Map(route.segments.map((s) => [s.id, s]));
  const blocking = conflicts.some((c) =>
    c.segmentIds.some((id) => segById.get(id)?.status === "known_barrier"),
  );
  if (blocking) return "conflicts";
  if (conflicts.length > 0) return "partial";
  if (route.summary.coverage.unknown > 0.5) return "insufficient_data";
  return "meets";
}

/** Lower is better. Weights are documented in docs/ROUTE_RANKING.md. */
export function scoreRoute(route: RouteDraft, prefs: MobilityPreferences, conflicts = findConflicts(route, prefs)): number {
  const { coverage, distanceMeters, unverifiedReportCount, knownBarrierCount } = route.summary;
  const segById = new Map(route.segments.map((s) => [s.id, s]));
  let score = 0;

  for (const conflict of conflicts) {
    const hard = conflict.segmentIds.some((id) => segById.get(id)?.status === "known_barrier");
    score += hard ? 1000 : 150;
  }
  score += knownBarrierCount * 120;
  score += unverifiedReportCount * (prefs.avoidReportedObstacles ? 90 : 35);
  score += coverage.unknown * (prefs.preferVerifiedRoutes ? 500 : 220);
  score += coverage.reported_unverified * 160;
  score += distanceMeters / (prefs.preferShorterRoutes ? 2 : 7);
  return Math.round(score);
}

function newest(route: RouteDraft) {
  return route.summary.newestObservationAt ? Date.parse(route.summary.newestObservationAt) : 0;
}

/** Ranks routes and attaches compatibility + reasons. Pure and deterministic. */
export function rankRoutes(drafts: RouteDraft[], prefs: MobilityPreferences): Route[] {
  const evaluated = drafts.map((route) => {
    const conflicts = findConflicts(route, prefs);
    return { route, conflicts, score: scoreRoute(route, prefs, conflicts) };
  });
  evaluated.sort((a, b) => a.score - b.score || a.route.summary.distanceMeters - b.route.summary.distanceMeters);

  const min = (f: (r: RouteDraft) => number) => Math.min(...drafts.map(f));
  const max = (f: (r: RouteDraft) => number) => Math.max(...drafts.map(f));
  const anyStairs = (r: RouteDraft) => r.hazards.some((h) => h.type === "stairs" && h.status !== "resolved");
  const slopeOk = (r: RouteDraft) =>
    prefs.maxSlopePercent === null || r.segments.every((s) => s.maxSlopePercent === null || s.maxSlopePercent <= prefs.maxSlopePercent!);

  return evaluated.map(({ route, conflicts }, index) => {
    const reasons: RecommendationReason[] = [];
    const multiple = drafts.length > 1;
    if (multiple) {
      if (route.summary.knownBarrierCount === min((r) => r.summary.knownBarrierCount) && max((r) => r.summary.knownBarrierCount) > route.summary.knownBarrierCount)
        reasons.push("fewest_known_barriers");
      if (prefs.avoidStairs && !anyStairs(route) && drafts.some(anyStairs)) reasons.push("avoids_stairs");
      if (prefs.maxSlopePercent !== null && slopeOk(route) && drafts.some((r) => !slopeOk(r))) reasons.push("within_slope_preference");
      if (route.summary.coverage.verified_accessible === max((r) => r.summary.coverage.verified_accessible) && min((r) => r.summary.coverage.verified_accessible) < route.summary.coverage.verified_accessible)
        reasons.push("highest_verified_coverage");
      if (route.summary.unverifiedReportCount === min((r) => r.summary.unverifiedReportCount) && max((r) => r.summary.unverifiedReportCount) > route.summary.unverifiedReportCount)
        reasons.push("fewest_unverified_reports");
      if (route.summary.distanceMeters === min((r) => r.summary.distanceMeters)) reasons.push("shortest_distance");
      if (newest(route) === max(newest) && min(newest) < newest(route)) reasons.push("most_recent_data");
    }
    return {
      ...route,
      compatibility: { level: compatibilityLevel(route, conflicts), conflicts },
      recommendation: { rank: index + 1, reasons },
    };
  });
}

/** Share of route length in each status. */
export function coverageOf(segments: RouteSegment[]): Route["summary"]["coverage"] {
  const total = segments.reduce((sum, s) => sum + s.lengthMeters, 0) || 1;
  const sum = (status: RouteSegment["status"]) =>
    segments.filter((s) => s.status === status).reduce((acc, s) => acc + s.lengthMeters, 0) / total;
  return {
    verified_accessible: sum("verified_accessible"),
    known_barrier: sum("known_barrier"),
    reported_unverified: sum("reported_unverified"),
    unknown: sum("unknown"),
  };
}
