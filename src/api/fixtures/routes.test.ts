import { describe, expect, it } from "vitest";
import { RoutesResponseSchema, type MobilityPreferences } from "../contracts";
import { ApiError } from "../errors";
import { generateFixtureHazards, generateFixtureRoutes } from "./routes";

const prefs: MobilityPreferences = {
  profile: "manual_wheelchair",
  maxSlopePercent: 5,
  minWidthCm: null,
  avoidStairs: true,
  avoidSteepCurbs: true,
  avoidDamagedSurfaces: true,
  avoidReportedObstacles: false,
  avoidNarrowPassages: true,
  preferVerifiedRoutes: true,
  preferShorterRoutes: false,
};

const unionStation = { lat: 43.6453, lng: -79.3806 };
const stLawrenceMarket = { lat: 43.6487, lng: -79.3715 };
const now = new Date("2026-07-01T12:00:00-04:00");
const request = { origin: unionStation, destination: stLawrenceMarket, preferences: prefs, departAt: null, alternatives: 3 };

describe("generateFixtureRoutes", () => {
  it("produces contract-valid responses marked as development fixtures", () => {
    const response = generateFixtureRoutes(request, now);
    expect(() => RoutesResponseSchema.parse(response)).not.toThrow();
    expect(response.source).toBe("development-fixture");
    for (const route of response.routes) {
      expect(route.segments.every((s) => s.source === "development_fixture")).toBe(true);
      expect(route.hazards.every((h) => h.source === "development_fixture")).toBe(true);
      // Never invent street names on synthetic geometry.
      expect(route.steps.every((s) => s.streetName === null)).toBe(true);
    }
  });

  it("is deterministic for the same request", () => {
    expect(generateFixtureRoutes(request, now)).toEqual(generateFixtureRoutes(request, now));
  });

  it("starts and ends exactly at the requested points", () => {
    for (const route of generateFixtureRoutes(request, now).routes) {
      const coords = route.geometry.coordinates;
      expect(coords[0]).toEqual([unionStation.lng, unionStation.lat]);
      expect(coords[coords.length - 1]).toEqual([stLawrenceMarket.lng, stLawrenceMarket.lat]);
    }
  });

  it("ranks routes 1..n and coverage sums to 1", () => {
    const { routes } = generateFixtureRoutes(request, now);
    expect(routes.map((r) => r.recommendation.rank)).toEqual([1, 2, 3]);
    for (const r of routes) {
      const c = r.summary.coverage;
      expect(c.verified_accessible + c.known_barrier + c.reported_unverified + c.unknown).toBeCloseTo(1, 5);
    }
  });

  it("never recommends a route with stairs first when stairs should be avoided and an alternative exists", () => {
    const { routes } = generateFixtureRoutes(request, now);
    const hasStairs = (i: number) => routes[i].hazards.some((h) => h.type === "stairs");
    if (routes.some((_, i) => !hasStairs(i))) expect(hasStairs(0)).toBe(false);
  });

  it("refuses to generate routes outside the GTA", () => {
    expect(() => generateFixtureRoutes({ ...request, destination: { lat: 45.4215, lng: -75.6972 } }, now)).toThrow(ApiError);
  });

  it("produces winter hazards only in winter months", () => {
    const winter = generateFixtureRoutes(request, new Date("2026-01-15T12:00:00-05:00"));
    const summer = generateFixtureRoutes(request, now);
    const types = (r: typeof winter) => r.routes.flatMap((x) => x.hazards.map((h) => h.type));
    expect(types(summer)).not.toContain("snow_blocked");
    expect(types(summer)).not.toContain("ice");
    expect(types(winter).some((t) => t === "snow_blocked" || t === "ice")).toBe(true);
  });
});

describe("generateFixtureHazards", () => {
  it("is stable across overlapping viewports", () => {
    const a = generateFixtureHazards([-79.4, 43.64, -79.37, 43.66], now);
    const b = generateFixtureHazards([-79.41, 43.63, -79.36, 43.67], now);
    const ids = new Set(b.map((h) => h.id));
    expect(a.every((h) => ids.has(h.id))).toBe(true);
  });

  it("returns nothing when zoomed far out", () => {
    expect(generateFixtureHazards([-80, 43, -79, 44], now)).toEqual([]);
  });
});
