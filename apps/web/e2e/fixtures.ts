import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export const TRIP = "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154";

export interface Settings {
  theme?: "light" | "dark";
  contrast?: "normal" | "more";
  textScale?: number;
  motion?: "reduced" | "full" | "system";
}

/** Persist settings the way the app does, before any page script runs. */
export async function useSettings(page: Page, s: Settings) {
  await page.addInitScript((state) => {
    localStorage.setItem("pathable:settings", JSON.stringify({ state: { motion: "reduced", ...state }, version: 1 }));
  }, s);
}

export const test = base.extend<{ stubbed: void }>({
  stubbed: [
    async ({ page }, use) => {
      // No third-party network in tests: tiles fail (exercising the plain-background
      // fallback), and the geocoder returns a fixed answer.
      await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
      await page.route("https://photon.komoot.io/**", (route) =>
        route.fulfill({
          json: {
            features: [
              { geometry: { coordinates: [-79.49154, 43.76397] }, properties: { name: "Finch West Station", district: "North York", osm_id: 1 } },
            ],
          },
        }),
      );
      await use();
    },
    { auto: true },
  ],
});

export async function expectNoAxeViolations(page: Page, context = "") {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // MapLibre's canvas is decorative here; every map fact is also available as text.
    .exclude(".maplibregl-canvas")
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(summary, `axe violations ${context}`).toEqual([]);
}

/** Next keeps previously visited routes mounted but hidden; only count what is visible. */
export const visible = (page: Page, selector: string) => page.locator(`${selector}:visible`);

export { expect };
