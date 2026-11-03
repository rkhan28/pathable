import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";

describe("trust pages", () => {
  it("exist in both languages with the same structure", () => {
    const en = PAGES["en-CA"];
    const fr = PAGES["fr-CA"];
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    for (const id of Object.keys(en) as (keyof typeof en)[]) {
      expect(fr[id].sections.map((s) => s.body.length)).toEqual(en[id].sections.map((s) => s.body.length));
      expect(Boolean(fr[id].draft)).toBe(Boolean(en[id].draft));
      expect(fr[id].intro).not.toBe(en[id].intro);
    }
  });

  it("never claim conformance", () => {
    for (const page of Object.values(PAGES["en-CA"])) {
      expect(JSON.stringify(page)).not.toMatch(/\b(fully|is) (compliant|conformant)\b|meets WCAG/i);
    }
  });

  it("marks privacy and terms as drafts", () => {
    expect(PAGES["en-CA"].privacy.draft).toBe(true);
    expect(PAGES["en-CA"].terms.draft).toBe(true);
  });
});
