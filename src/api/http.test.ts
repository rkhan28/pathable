import { afterEach, describe, expect, it, vi } from "vitest";
import { generateFixtureRoutes } from "./fixtures/routes";
import { RoutesResponseSchema, type RouteRequest } from "./contracts";
import { ApiError } from "./errors";
import { requestJson } from "./http";

const request: RouteRequest = {
  origin: { lat: 43.6453, lng: -79.3806 },
  destination: { lat: 43.6487, lng: -79.3715 },
  preferences: {
    profile: "custom",
    maxSlopePercent: null,
    minWidthCm: null,
    avoidStairs: false,
    avoidSteepCurbs: false,
    avoidDamagedSurfaces: false,
    avoidReportedObstacles: false,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: true,
    preferShorterRoutes: false,
  },
  departAt: null,
  alternatives: 3,
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

afterEach(() => vi.unstubAllGlobals());

describe("requestJson", () => {
  it("returns data that matches the contract", async () => {
    const body = { ...generateFixtureRoutes(request), source: "live" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body)));
    const data = await requestJson("https://api.example.test", "v1/routes", RoutesResponseSchema, { method: "POST", body: request });
    expect(data.routes).toHaveLength(3);
  });

  it("rejects responses that don't match the contract instead of rendering them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ routes: [{ id: 1 }] })));
    await expect(requestJson("https://api.example.test", "v1/routes", RoutesResponseSchema)).rejects.toMatchObject({ code: "contract_mismatch" });
  });

  it("maps documented API errors to typed errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: { code: "outside_coverage", message: "Outside", retryAfterSeconds: null } }, { status: 422 })),
    );
    const error = await requestJson("https://api.example.test", "v1/routes", RoutesResponseSchema).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("outside_coverage");
    expect(error.retryable).toBe(false);
  });

  it("treats 5xx without a body as retryable unavailability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 503 })));
    const error = await requestJson("https://api.example.test", "v1/routes", RoutesResponseSchema).catch((e) => e);
    expect(error.code).toBe("unavailable");
    expect(error.retryable).toBe(true);
  });

  it("maps network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await requestJson("https://api.example.test", "v1/routes", RoutesResponseSchema).catch((e) => e);
    expect(error.code).toBe("network");
  });
});
