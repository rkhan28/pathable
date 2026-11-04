import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const API = process.env.LIVE_API_URL ?? "http://localhost:8000";
const TRIP = "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154";
// A real photo-sized JPEG with GPS and camera tags in its EXIF.
const GPS_JPEG = join(__dirname, "fixtures", "gps.jpg");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pathable:settings", JSON.stringify({ state: { motion: "reduced" }, version: 1 })));
  await page.route("https://photon.komoot.io/**", (route) =>
    route.fulfill({ json: { features: [{ geometry: { coordinates: [-79.49154, 43.76397] }, properties: { name: "Finch West Station", district: "North York", osm_id: 1 } }] } }),
  );
});

test("the API is up with a real data version", async ({ request }) => {
  const ready = await request.get(`${API}/readyz`);
  expect(ready.ok()).toBeTruthy();
  expect((await ready.json()).dataVersion).toMatch(/^north-york-|^corridor-/);
});

test("live routes: no development label, real alternatives, details and guidance", async ({ page, isMobile }) => {
  const started = Date.now();
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  expect(Date.now() - started).toBeLessThan(8000);
  await expect(page.getByText("Development data")).toHaveCount(0);
  expect(await page.locator(".pa-route-card:visible").count()).toBeGreaterThan(1);
  await expect(page.locator("[data-map-status]")).toHaveAttribute("data-map-status", /ready|fallback-style/, { timeout: 20000 });
  if (!isMobile) {
    await page.locator("input.pa-route-radio").nth(1).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("input.pa-route-radio").nth(2)).toBeChecked();
  }
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByRole("tab", { name: "Sections" }).click();
  await expect(page.getByText(/2023 lidar terrain model/).first()).toBeVisible();
  // The test browser has no location, so guidance runs as a preview along the route.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const guidance = page.getByRole("region", { name: "Guidance" });
  await expect(guidance.getByText(/Preview/)).toBeVisible();
  await guidance.getByRole("button", { name: "Pause preview" }).click();
  const first = await guidance.getByRole("heading").textContent();
  await guidance.getByRole("button", { name: "Next step" }).click();
  await expect(guidance.getByRole("heading")).not.toHaveText(first!);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude(".maplibregl-canvas").analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test("live transit: a real TTC option with its line, then guidance that says where to get off", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  await page.getByRole("radio", { name: /^Transit/ }).click();
  const option = page.getByRole("radio", { name: /Arrive/ }).first();
  await expect(option).toBeChecked();
  await expect(page.getByText("Scheduled TTC times")).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const guidance = page.getByRole("region", { name: "Guidance" });
  await guidance.getByRole("button", { name: "Pause preview" }).click();
  // The walk to the stop can be a short one or eight steps, depending on which option is first at this hour.
  for (let i = 0; i < 20 && !(await guidance.getByRole("heading", { name: /Get off at/ }).count()); i++) {
    await guidance.getByRole("button", { name: "Next step" }).click();
  }
  await expect(guidance.getByRole("heading", { name: /Get off at/ })).toBeVisible();
  await guidance.getByRole("button", { name: "End" }).click();
  await expect(guidance).toHaveCount(0);
});

test("search finds a place and opens the planner with live routes", async ({ page }) => {
  await page.goto("/en-CA");
  await page.getByRole("combobox", { name: "Where to?" }).fill("Finch");
  await page.getByRole("option", { name: /Finch West Station/ }).click();
  await expect(page).toHaveURL(/\/navigate\?to=/);
  await page.getByRole("combobox", { name: "From" }).fill("43.77412, -79.49963");
  await page.keyboard.press("Enter");
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
});

test("a report with a photo is sent, appears near the route, and can be withdrawn", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "one report per run is enough");
  // A point on the York University to Finch West corridor.
  const lat = 43.77, lon = -79.4996;
  await page.goto("/en-CA/report");
  await page.locator('input[type="file"]').setInputFiles(GPS_JPEG);
  await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("combobox").fill(`${lat}, ${lon}`);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Automatic photo analysis is turned off/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("What did you find?").selectOption("obstacle");
  await page.getByLabel("Describe it").fill("Sandwich board across the sidewalk (live e2e)");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".pa-notice").getByText(/^Report sent/)).toBeVisible();

  const box = `${lon - 0.002},${lat - 0.002},${lon + 0.002},${lat + 0.002}`;
  const mine = (await (await request.get(`${API}/v1/hazards?bbox=${box}`)).json()).hazards.filter((h: { source: string }) => h.source === "community-report");
  expect(mine.length).toBeGreaterThan(0);

  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  await expect(page.locator('section[aria-labelledby="reports-title"]').getByText("Obstacle").first()).toBeVisible();

  await page.goto("/en-CA/settings");
  await page.getByRole("button", { name: "Withdraw" }).first().click();
  await expect(page.getByText("Withdrawn").first()).toBeVisible();
});

test("a report location can be picked on the map", async ({ page, isMobile }) => {
  test.skip(isMobile, "pointer picking is covered on desktop");
  await page.goto("/en-CA/report");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Choose on map" }).click();
  const map = page.locator(".pa-report-map");
  await expect(map.locator("[data-map-status]")).toHaveAttribute("data-map-status", /ready|fallback-style/, { timeout: 20000 });
  const b = (await map.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.getByRole("combobox")).toHaveValue(/Coordinates 43\.\d+, -79\.\d+/);
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("outside the covered area is refused, not guessed", async ({ page }) => {
  await page.goto("/en-CA/navigate?from=43.80,-79.30&to=43.76397,-79.49154");
  // The message names the area this service has loaded (the corridor on the local stack).
  await expect(page.getByText(/That trip is outside the demo corridor/)).toBeVisible({ timeout: 15000 });
});

test("French interface with live data", async ({ page }) => {
  await page.goto(TRIP.replace("/en-CA", "/fr-CA"));
  await page.getByRole("radio", { name: /Itinéraire A/ }).waitFor();
  await expect(page.getByRole("heading", { name: "Itinéraires selon vos préférences" })).toBeVisible();
});
