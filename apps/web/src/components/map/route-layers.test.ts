import { describe, expect, it } from "vitest";
import { flowGradient, segmentFeatures } from "./route-layers";
import corridor from "@/generated/fixtures/routes/york-u-finch-west.json";
import { RouteResponse } from "@/lib/api/contracts";

describe("flowGradient", () => {
  it.each([0, 0.01, 0.5, 0.97, 1, 1.3])("has strictly ascending stops in [0,1] at phase %s", (phase) => {
    const expr = flowGradient(phase, "#fff");
    const positions = expr.slice(3).filter((_, i) => i % 2 === 0) as number[];
    expect(positions[0]).toBe(0);
    expect(positions.at(-1)).toBe(1);
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });
});

describe("segmentFeatures", () => {
  it("covers the route from 0 to 1 with one feature per segment", () => {
    const route = RouteResponse.parse(corridor.response).routes[0];
    const fc = segmentFeatures(route);
    expect(fc.features).toHaveLength(route.segments.length);
    expect(fc.features[0].properties!.start).toBe(0);
    expect(fc.features.at(-1)!.properties!.end).toBeCloseTo(1, 6);
    for (const f of fc.features) expect(f.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });
});
