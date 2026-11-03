// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RouteResponse, TransitResponse } from "./api/contracts";
import { fromRoute, fromTransit, locate, pointAt, progress } from "./journey";

const fixture = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../contracts/fixtures/${path}`, import.meta.url)), "utf8"));
const route = RouteResponse.parse(fixture("routes/york-u-finch-west.json").response).routes[0];
const transit = TransitResponse.parse(fixture("transit/york-u-finch-west.json").response).options[0];

describe("walking journey", () => {
  const j = fromRoute(route);

  it("measures the same length as the route", () => {
    expect(j.totalM).toBeCloseTo(route.distanceM, -1);
  });

  it("finds a point on the line exactly where it is", () => {
    for (const d of [0, 37, j.totalM / 2, j.totalM - 1]) {
      const fix = locate(j, pointAt(j, d).position, Math.max(0, d - 10));
      expect(fix.along).toBeCloseTo(d, 0);
      expect(fix.offRouteM).toBeLessThan(0.5);
    }
  });

  it("measures how far a position is off the line", () => {
    const { position } = pointAt(j, 200);
    const off: [number, number] = [position[0] + 0.0006, position[1]]; // about 48 m east
    expect(locate(j, off, 190).offRouteM).toBeGreaterThan(20);
  });

  it("always points at the next step, then arrives", () => {
    const start = progress(j, 0);
    expect(start.nextIndex).toBe(1);
    expect(start.toNextM).toBeCloseTo(j.steps[1].along, 3);
    for (const at of [j.steps[1].along + 1, j.totalM / 3, j.totalM / 2]) {
      const p = progress(j, at);
      expect(p.next.along).toBeGreaterThan(at);
      expect(j.steps[p.nextIndex - 1].along).toBeLessThanOrEqual(at + 4);
    }
    const end = progress(j, j.totalM - 5);
    expect(end.arrived).toBe(true);
    expect(end.next.kind === "walk" && end.next.step.maneuver).toBe("arrive");
  });

  it("estimates time from the walking speed", () => {
    expect(progress(j, 0).remainingS).toBeCloseTo(j.totalM, -1);
  });
});

describe("transit journey", () => {
  const j = fromTransit(transit);
  const kinds = j.steps.map((s) => (s.kind === "walk" ? s.step.maneuver : s.kind));

  it("walks to the stop, boards, gets off, then walks to the end", () => {
    const board = kinds.indexOf("board");
    const alight = kinds.indexOf("alight");
    expect(board).toBeGreaterThan(0);
    expect(alight).toBeGreaterThan(board);
    expect(kinds.at(-1)).toBe("arrive");
    expect(kinds.filter((k) => k === "arrive")).toHaveLength(1);
  });

  it("says where to get off while riding, and counts scheduled ride time", () => {
    const ride = j.rides[0];
    const p = progress(j, (ride.startM + ride.endM) / 2);
    expect(p.next.kind).toBe("alight");
    expect(p.ride).not.toBeNull();
    expect(p.arrived).toBe(false);
    const rideS = (Date.parse(ride.leg.arriveAt) - Date.parse(ride.leg.departAt)) / 1000;
    const after = (j.totalM - ride.endM) / 1.0;
    expect(p.remainingS).toBeCloseTo(rideS / 2 + after, -1);
  });

  it("keeps walking segments aligned with the joined line", () => {
    for (const s of j.segments) {
      expect(s.to).toBeLessThan(j.geometry.length);
      expect(s.from).toBeLessThanOrEqual(s.to);
    }
  });
});
