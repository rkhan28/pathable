/**
 * Knowledge-state and ranking rules. The API applies the same rules in
 * services/api/pathable_api/scoring.py; both are tested against
 * contracts/fixtures/scoring-cases.json so they cannot drift apart.
 * The rules are explained in docs/ROUTE_RANKING.md and ADR 0001.
 */
import type {
  Compatibility,
  Evidence,
  Hazard,
  KnowledgeState,
  Preferences,
  Reason,
  Segment,
} from "./api/contracts";

export type Check = "pass" | "fail" | "unknown";

export const SURFACE_PASS = new Set([
  "asphalt", "concrete", "concrete:plates", "concrete:lanes", "paving_stones", "paved", "tartan", "rubber",
]);
export const SURFACE_FAIL = new Set([
  "gravel", "fine_gravel", "dirt", "ground", "grass", "sand", "mud", "earth", "unpaved", "compacted",
  "pebblestone", "woodchips", "sett", "cobblestone", "unhewn_cobblestone", "grass_paver", "rock",
]);
const GOOD_KERBS = new Set(["lowered", "flush", "no"]);

/** Cost multipliers per metre in each state; see docs/ROUTE_RANKING.md. */
export const STATE_WEIGHT = { verified: 1, unknown: 1.25, unverified: 1.8, barrier: 6 } as const;
export const UNKNOWN_WEIGHT_PREFER_VERIFIED = 1.6;

/** A measured value near a threshold is unknown: the measurement cannot tell which side it is on. */
export function threeWay(value: number | null, threshold: number, margin: number, higherIsBetter: boolean): Check {
  if (value === null || !Number.isFinite(value)) return "unknown";
  const delta = higherIsBetter ? value - threshold : threshold - value;
  if (delta > margin) return "pass";
  if (delta < -margin) return "fail";
  return "unknown";
}

export function checkEvidence(e: Evidence, prefs: Preferences): Check | null {
  switch (e.attribute) {
    case "presence":
      return e.value === null ? "unknown" : e.value === true ? "pass" : "fail";
    case "steps":
      if (e.value !== true) return "pass";
      return prefs.avoidStairs ? "fail" : "pass";
    case "surface": {
      if (typeof e.value !== "string") return "unknown";
      if (SURFACE_PASS.has(e.value)) return "pass";
      if (SURFACE_FAIL.has(e.value)) return prefs.avoidDamagedSurfaces ? "fail" : "pass";
      return "unknown";
    }
    case "width":
      if (!prefs.avoidNarrow) return null;
      return threeWay(typeof e.value === "number" ? e.value : null, prefs.minWidthM, e.error ?? 0, true);
    case "running_slope": {
      const margin = e.error ?? 0;
      const primary = threeWay(typeof e.value === "number" ? e.value : null, prefs.maxRunningSlopePct, margin, false);
      // Lidar slope only counts when two independent surveys agree (ADR 0001).
      if (!e.corroboration) return "unknown";
      const second = threeWay(e.corroboration.value, prefs.maxRunningSlopePct, margin, false);
      return primary === second ? primary : "unknown";
    }
    case "kerbs": {
      if (!prefs.avoidMissingRamps) return null;
      if (typeof e.value !== "string") return "unknown";
      const ends = e.value.split(";");
      if (ends.some((k) => k === "raised")) return "fail";
      return ends.length === 2 && ends.every((k) => GOOD_KERBS.has(k)) ? "pass" : "unknown";
    }
    case "aps":
      return null;
  }
}

export function segmentState(segment: Pick<Segment, "id" | "evidence">, prefs: Preferences, hazards: Hazard[]): KnowledgeState {
  const checks = segment.evidence.map((e) => checkEvidence(e, prefs)).filter((c): c is Check => c !== null);
  if (checks.includes("fail")) return "barrier";
  const onSegment = hazards.filter((h) => h.segmentId === segment.id);
  if (onSegment.some((h) => h.status === "verified" && prefs.avoidReportedObstacles)) return "barrier";
  if (onSegment.some((h) => h.status === "reported") && prefs.avoidReportedObstacles) return "unverified";
  if (checks.length > 0 && checks.every((c) => c === "pass")) return "verified";
  return "unknown";
}

export interface RouteInput {
  id: string;
  distanceM: number;
  segments: Pick<Segment, "id" | "lengthM" | "kind" | "evidence">[];
  hazards: Hazard[];
}

export interface RouteScore {
  id: string;
  states: Record<string, KnowledgeState>;
  lengthByState: Record<KnowledgeState, number>;
  barrierCount: number;
  reportCount: number;
  compatibility: Compatibility;
  score: number;
  rank: number;
  reasons: Reason[];
  hasSteps: boolean;
  steepestFailPct: number | null;
  unknownKerbs: number;
}

const COMPAT_ORDER: Record<Compatibility, number> = { compatible: 0, unknowns: 1, incompatible: 2 };

function round(n: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function scoreRoute(route: RouteInput, prefs: Preferences): Omit<RouteScore, "rank" | "reasons"> {
  const states: Record<string, KnowledgeState> = {};
  const lengthByState: Record<KnowledgeState, number> = { verified: 0, barrier: 0, unverified: 0, unknown: 0 };
  let barrierCount = 0;
  let previous: KnowledgeState | null = null;
  let steepestFailPct: number | null = null;
  let unknownKerbs = 0;
  for (const seg of route.segments) {
    const state = segmentState(seg, prefs, route.hazards);
    states[seg.id] = state;
    lengthByState[state] += seg.lengthM;
    if (state === "barrier" && previous !== "barrier") barrierCount++;
    previous = state;
    for (const e of seg.evidence) {
      const c = checkEvidence(e, prefs);
      if (e.attribute === "running_slope" && c === "fail" && typeof e.value === "number") {
        steepestFailPct = Math.max(steepestFailPct ?? 0, e.value);
      }
      if (e.attribute === "kerbs" && c === "unknown") unknownKerbs++;
    }
  }
  const unknownWeight = prefs.preferVerified ? UNKNOWN_WEIGHT_PREFER_VERIFIED : STATE_WEIGHT.unknown;
  const soften = (w: number) => (prefs.preferShorter ? 1 + (w - 1) * 0.5 : w);
  const score =
    lengthByState.verified * STATE_WEIGHT.verified +
    lengthByState.unknown * soften(unknownWeight) +
    lengthByState.unverified * soften(STATE_WEIGHT.unverified) +
    lengthByState.barrier * soften(STATE_WEIGHT.barrier);
  const compatibility: Compatibility =
    lengthByState.barrier > 0 ? "incompatible" : lengthByState.unknown + lengthByState.unverified > 0 ? "unknowns" : "compatible";
  return {
    id: route.id,
    states,
    lengthByState,
    barrierCount,
    reportCount: route.hazards.filter((h) => h.status === "reported").length,
    compatibility,
    score: round(score, 1),
    hasSteps: route.segments.some((s) => s.kind === "steps"),
    steepestFailPct: steepestFailPct === null ? null : round(steepestFailPct, 1),
    unknownKerbs,
  };
}

/** Score, rank and explain alternatives. Ranking: compatibility, then score, then distance. */
export function rankRoutes(routes: RouteInput[], prefs: Preferences): RouteScore[] {
  const scored = routes.map((r) => ({ ...scoreRoute(r, prefs), distanceM: r.distanceM }));
  const order = [...scored].sort(
    (a, b) => COMPAT_ORDER[a.compatibility] - COMPAT_ORDER[b.compatibility] || a.score - b.score || a.distanceM - b.distanceM,
  );
  const minBarriers = Math.min(...scored.map((s) => s.barrierCount));
  const verifiedShare = (s: (typeof scored)[number]) => s.lengthByState.verified / Math.max(s.distanceM, 1);
  const maxVerified = Math.max(...scored.map(verifiedShare));
  const minDistance = Math.min(...scored.map((s) => s.distanceM));
  const anySteps = scored.some((s) => s.hasSteps);
  const unique = (pred: (s: (typeof scored)[number]) => boolean) => scored.filter(pred).length === 1;

  return order.map(({ distanceM, ...s }, i) => {
    const reasons: Reason[] = [];
    if (scored.length > 1 && s.barrierCount === minBarriers && unique((o) => o.barrierCount === minBarriers)) {
      reasons.push({ code: "fewest_barriers", value: s.barrierCount });
    }
    const share = s.lengthByState.verified / Math.max(distanceM, 1);
    if (scored.length > 1 && share === maxVerified && share > 0 && unique((o) => verifiedShare(o) === maxVerified)) {
      reasons.push({ code: "most_verified", value: round(share * 100) });
    }
    if (scored.length > 1 && distanceM === minDistance && unique((o) => o.distanceM === minDistance)) {
      reasons.push({ code: "shortest", value: round(distanceM) });
    }
    if (anySteps && !s.hasSteps) reasons.push({ code: "avoids_steps" });
    if (s.barrierCount > 0) reasons.push({ code: "has_barriers", value: s.barrierCount });
    if (s.steepestFailPct !== null) reasons.push({ code: "steepest_section", value: s.steepestFailPct });
    if (s.unknownKerbs > 0) reasons.push({ code: "unknown_kerbs", value: s.unknownKerbs });
    if (s.reportCount > 0) reasons.push({ code: "reported_hazards", value: s.reportCount });
    return { ...s, rank: i + 1, reasons };
  });
}
