import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared test setup:
 * - Third-party map tiles are blocked so tests are deterministic and offline-safe
 *   (this also exercises the map's graceful fallback).
 * - The Photon geocoder is replaced with a fixed response.
 */
export const PHOTON_RESULTS = {
  features: [
    {
      geometry: { coordinates: [-79.3806, 43.6453] },
      properties: { osm_id: 1, osm_type: "W", name: "Union Station", street: "Front Street West", housenumber: "65", city: "Toronto", type: "house" },
    },
    {
      geometry: { coordinates: [-79.3715, 43.6487] },
      properties: { osm_id: 2, osm_type: "W", name: "St. Lawrence Market", street: "Front Street East", housenumber: "93", city: "Toronto", type: "house" },
    },
  ],
};

export async function stubNetwork(page: Page) {
  await page.route(/tiles\.openfreemap\.org/, (route) => route.abort());
  await page.route(/photon\.komoot\.io\/api/, async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q")?.toLowerCase() ?? "";
    const features = PHOTON_RESULTS.features.filter((f) => f.properties.name.toLowerCase().includes(q.slice(0, 5)));
    await route.fulfill({ json: { features } });
  });
  await page.route(/photon\.komoot\.io\/reverse/, (route) => route.fulfill({ json: { features: [PHOTON_RESULTS.features[1]] } }));
}

export const test = base.extend<{ stubbed: void }>({
  stubbed: [
    async ({ page }, use) => {
      await stubNetwork(page);
      // Interacting before React hydrates would test the static HTML, not the app.
      const goto = page.goto.bind(page);
      page.goto = async (url, options) => {
        const response = await goto(url, options);
        await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
        return response;
      };
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export async function expectNoAxeViolations(page: Page, options: { exclude?: string[]; include?: string } = {}) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (options.include) builder = builder.include(options.include).disableRules(["region", "page-has-heading-one", "landmark-one-main"]);
  for (const sel of options.exclude ?? []) builder = builder.exclude(sel);
  const { violations } = await builder.analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

export const TRIP_QUERY = "from=43.6453,-79.3806&to=43.6487,-79.3715&fromName=Union%20Station&toName=St.%20Lawrence%20Market";

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
}
