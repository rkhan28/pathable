// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Preferences } from "./api/contracts";
import { rankRoutes, segmentState, threeWay } from "./scoring";

const cases = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../../contracts/fixtures/scoring-cases.json", import.meta.url)), "utf8"),
);

describe("shared scoring cases (must match services/api)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture JSON, validated by the assertions
  it.each(cases as any[])("$name", (c) => {
    const prefs = c.preferences as Preferences;
    if (c.kind === "segments") {
      const got = Object.fromEntries(
        c.input.segments.map((s: { id: string }) => [s.id, segmentState(s as never, prefs, c.input.hazards)]),
      );
      expect(got).toEqual(c.expected);
    } else {
      const got = rankRoutes(c.input.routes, prefs).map((s) => ({
        id: s.id,
        rank: s.rank,
        compatibility: s.compatibility,
        score: s.score,
        barrierCount: s.barrierCount,
        lengthByState: s.lengthByState,
        reasons: s.reasons,
      }));
      expect(got).toEqual(c.expected);
    }
  });
});

describe("threeWay", () => {
  it("refuses to decide within the measurement error", () => {
    expect(threeWay(5.1, 5, 0.17, false)).toBe("unknown");
    expect(threeWay(4.7, 5, 0.17, false)).toBe("pass");
    expect(threeWay(5.4, 5, 0.17, false)).toBe("fail");
    expect(threeWay(null, 5, 0.17, false)).toBe("unknown");
  });
});

describe("no data", () => {
  it("is never scored as verified", () => {
    const prefs = cases[0].preferences as Preferences;
    expect(segmentState({ id: "x", evidence: [] }, prefs, [])).toBe("unknown");
    expect(
      segmentState({ id: "y", evidence: [{ attribute: "surface", value: null, source: null, observedOn: null }] }, prefs, []),
    ).toBe("unknown");
  });
});
