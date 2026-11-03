// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rankRoutes } from "../scoring";
import { Preferences, RouteResponse } from "./contracts";

const dir = fileURLToPath(new URL("../../../../../contracts/fixtures/routes/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe.each(files)("fixture %s", (file) => {
  const doc = JSON.parse(readFileSync(dir + file, "utf8"));

  it("matches the API contract", () => {
    const parsed = RouteResponse.safeParse(doc.response);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(Preferences.parse(doc.preferences)).toBeTruthy();
  });

  it("is labelled as a development fixture", () => {
    expect(doc.response.source).toBe("development-fixture");
  });

  it("ranks identically in the client and the pipeline", () => {
    const response = RouteResponse.parse(doc.response);
    const client = rankRoutes(response.routes, doc.preferences);
    expect(client.map((r) => [r.id, r.rank, r.score, r.compatibility])).toEqual(
      response.routes.map((r) => [r.id, r.rank, r.score, r.compatibility]),
    );
    for (const r of response.routes) {
      const mine = client.find((c) => c.id === r.id)!;
      for (const s of r.segments) expect(mine.states[s.id]).toBe(s.state);
      expect(mine.reasons).toEqual(r.reasons);
    }
  });

  it("never marks a segment verified while a checked attribute is unknown", () => {
    const checked = new Set(["presence", "surface", "width", "running_slope", "kerbs"]);
    let verified = 0;
    for (const r of doc.response.routes)
      for (const s of r.segments)
        if (s.state === "verified") {
          verified++;
          const unknown = s.evidence.filter((e: { attribute: string; value: unknown }) => checked.has(e.attribute) && e.value === null);
          expect(unknown).toEqual([]);
        }
    expect(verified).toBeGreaterThan(0);
  });
});

import { FIXTURE_TRIPS } from "./fixture-trips";

describe("fixture trip endpoints", () => {
  it.each(Object.values(FIXTURE_TRIPS))("$id matches its fixture file", (trip) => {
    const doc = JSON.parse(readFileSync(`${dir}${trip.id}.json`, "utf8"));
    expect(doc.trip.origin[0]).toBeCloseTo(trip.origin[0], 4);
    expect(doc.trip.origin[1]).toBeCloseTo(trip.origin[1], 4);
    expect(doc.trip.destination[0]).toBeCloseTo(trip.destination[0], 4);
    expect(doc.trip.destination[1]).toBeCloseTo(trip.destination[1], 4);
  });
});
