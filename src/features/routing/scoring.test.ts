import { describe, expect, it } from "vitest";
import type { Hazard, MobilityPreferences, RouteSegment } from "@/api/contracts";
import { preferencesForProfile } from "@/features/preferences/profiles";
import { explainRoute } from "./explain";
import { compatibilityLevel, coverageOf, findConflicts, rankRoutes, type RouteDraft } from "./scoring";

const iso = "2026-07-01T12:00:00.000Z";

function segment(id: string, status: RouteSegment["status"], length: number, extra: Partial<RouteSegment> = {}): RouteSegment {
  return {
    id,
    startIndex: 0,
    endIndex: 1,
    status,
    lengthMeters: length,
    maxSlopePercent: null,
    minWidthCm: null,
    surface: "unknown",
    source: "field_survey",
    observedAt: iso,
    hazardIds: [],
    ...extra,
  };
}

function hazard(id: string, type: Hazard["type"], status: Hazard["status"] = "verified"): Hazard {
  return {
    id,
    type,
    location: { lat: 43.65, lng: -79.38 },
    status,
    severity: status === "verified" ? "blocking" : "caution",
    source: "field_survey",
    reportedAt: iso,
    verifiedAt: status === "verified" ? iso : null,
    expiresAt: null,
    confirmations: 1,
    description: null,
  };
}

function draft(id: string, segments: RouteSegment[], hazards: Hazard[] = []): RouteDraft {
  const distance = segments.reduce((s, x) => s + x.lengthMeters, 0);
  return {
    id,
    label: null,
    geometry: { type: "LineString", coordinates: [[-79.38, 43.65], [-79.37, 43.66]] },
    summary: {
      distanceMeters: distance,
      durationSeconds: distance,
      coverage: coverageOf(segments),
      knownBarrierCount: segments.filter((s) => s.status === "known_barrier").length,
      unverifiedReportCount: hazards.filter((h) => h.status === "reported").length,
      oldestObservationAt: iso,
      newestObservationAt: iso,
    },
    segments,
    hazards,
    steps: [],
  };
}

const wheelchair: MobilityPreferences = preferencesForProfile("manual_wheelchair");

describe("findConflicts", () => {
  it("flags stairs when the person avoids stairs", () => {
    const stairs = hazard("h1", "stairs");
    const route = draft("a", [segment("s1", "known_barrier", 100, { hazardIds: ["h1"] })], [stairs]);
    expect(findConflicts(route, wheelchair).map((c) => c.preference)).toContain("avoidStairs");
    expect(findConflicts(route, { ...wheelchair, avoidStairs: false }).map((c) => c.preference)).not.toContain("avoidStairs");
  });

  it("flags segments steeper than the slope limit, ignoring unknown slopes", () => {
    const route = draft("a", [segment("s1", "verified_accessible", 100, { maxSlopePercent: 7 }), segment("s2", "unknown", 100)]);
    const conflicts = findConflicts(route, { ...wheelchair, maxSlopePercent: 5 });
    expect(conflicts).toEqual([{ preference: "maxSlopePercent", segmentIds: ["s1"] }]);
    expect(findConflicts(route, { ...wheelchair, maxSlopePercent: null })).toEqual([]);
  });

  it("ignores resolved hazards", () => {
    const route = draft("a", [segment("s1", "verified_accessible", 100, { hazardIds: ["h1"] })], [hazard("h1", "stairs", "resolved")]);
    expect(findConflicts(route, wheelchair)).toEqual([]);
  });
});

describe("compatibilityLevel", () => {
  it("never reports a mostly-unknown route as meeting preferences", () => {
    const route = draft("a", [segment("s1", "unknown", 800), segment("s2", "verified_accessible", 200)]);
    expect(compatibilityLevel(route, [])).toBe("insufficient_data");
  });

  it("is 'conflicts' when a verified barrier conflicts with a preference", () => {
    const route = draft("a", [segment("s1", "known_barrier", 100, { hazardIds: ["h1"] })], [hazard("h1", "stairs")]);
    expect(compatibilityLevel(route, findConflicts(route, wheelchair))).toBe("conflicts");
  });
});

describe("rankRoutes", () => {
  const short = draft("short", [segment("s1", "verified_accessible", 300), segment("s2", "known_barrier", 50, { hazardIds: ["h1"] })], [hazard("h1", "stairs")]);
  const long = draft("long", [segment("l1", "verified_accessible", 700)]);

  it("ranks a longer barrier-free route above a shorter route with stairs for wheelchair users", () => {
    const ranked = rankRoutes([short, long], wheelchair);
    expect(ranked.map((r) => r.id)).toEqual(["long", "short"]);
    expect(ranked[0].recommendation.reasons).toEqual(expect.arrayContaining(["fewest_known_barriers", "avoids_stairs"]));
  });

  it("explains the trade-off in distance", () => {
    const ranked = rankRoutes([short, long], wheelchair);
    const e = explainRoute(ranked, "long")!;
    expect(e.isSuggested).toBe(true);
    expect(e.isShortest).toBe(false);
    expect(e.extraDistanceMeters).toBe(350);
  });

  it("treats unknown data as a cost, not as accessible", () => {
    const unknown = draft("unknown", [segment("u1", "unknown", 400)]);
    const verified = draft("verified", [segment("v1", "verified_accessible", 450)]);
    expect(rankRoutes([unknown, verified], wheelchair)[0].id).toBe("verified");
  });

  it("is deterministic and assigns ranks 1..n", () => {
    const a = rankRoutes([short, long], wheelchair);
    const b = rankRoutes([long, short], wheelchair);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(a.map((r) => r.recommendation.rank)).toEqual([1, 2]);
  });
});
