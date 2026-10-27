import type { PreferenceConflict, RecommendationReason, Route } from "@/api/contracts";

export interface RouteExplanation {
  rank: number;
  isSuggested: boolean;
  isOnly: boolean;
  isShortest: boolean;
  /** Metres longer than the shortest alternative (0 when shortest). */
  extraDistanceMeters: number;
  reasons: RecommendationReason[];
  conflicts: PreferenceConflict["preference"][];
  /** Compact comparison of every other route, for "why not that one?". */
  others: { id: string; rank: number; knownBarrierCount: number; verifiedShare: number; distanceMeters: number }[];
}

/**
 * Turns ranked routes into structured facts for the "Why this route?" text.
 * Kept pure (no i18n) so the logic is unit-tested and every language renders
 * the same facts.
 */
export function explainRoute(routes: Route[], routeId: string): RouteExplanation | null {
  const route = routes.find((r) => r.id === routeId);
  if (!route) return null;
  const shortest = Math.min(...routes.map((r) => r.summary.distanceMeters));
  const reasons = route.recommendation.reasons.filter((r) => r !== "shortest_distance");
  return {
    rank: route.recommendation.rank,
    isSuggested: route.recommendation.rank === 1,
    isOnly: routes.length === 1,
    isShortest: route.summary.distanceMeters === shortest,
    extraDistanceMeters: Math.max(0, route.summary.distanceMeters - shortest),
    reasons,
    conflicts: route.compatibility.conflicts.map((c) => c.preference),
    others: routes
      .filter((r) => r.id !== routeId)
      .map((r) => ({
        id: r.id,
        rank: r.recommendation.rank,
        knownBarrierCount: r.summary.knownBarrierCount,
        verifiedShare: r.summary.coverage.verified_accessible,
        distanceMeters: r.summary.distanceMeters,
      })),
  };
}
