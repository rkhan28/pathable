import { expectNoAxeViolations, test, TRIP_QUERY } from "./fixtures";

const PAGES = [
  "/en",
  "/en/navigate",
  `/en/navigate?${TRIP_QUERY}`,
  "/en/onboarding",
  "/en/report",
  "/en/settings",
  "/en/coverage",
  "/en/accessibility",
  "/en/help",
  "/en/contact",
  "/en/privacy",
  "/en/terms",
  "/en/ai",
  "/en/does-not-exist",
  "/fr",
  `/fr/navigate?${TRIP_QUERY}`,
  "/fr/report",
  "/fr/settings",
];

// MapLibre's attribution control is third-party UI; it is checked manually (docs/ACCESSIBILITY_TESTING.md).
const EXCLUDE = [".maplibregl-ctrl-attrib"];

test.describe("axe-core: WCAG 2.2 A/AA + best practices", () => {
  // Scan final visual states: entrance animations would otherwise be measured mid-fade.
  test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

  for (const path of PAGES) {
    test(`light theme ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      await expectNoAxeViolations(page, { exclude: EXCLUDE });
    });
  }

  for (const path of ["/en", `/en/navigate?${TRIP_QUERY}`, "/en/settings", "/en/report"]) {
    test(`dark theme ${path}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      await expectNoAxeViolations(page, { exclude: EXCLUDE });
    });

    test(`high contrast ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => (document.documentElement.dataset.contrast = "high"));
      await expectNoAxeViolations(page, { exclude: EXCLUDE });
    });
  }

  test("route details and guidance views", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await page.getByRole("button", { name: "Route details" }).click();
    await expectNoAxeViolations(page, { exclude: EXCLUDE });
    await page.getByRole("tab", { name: "Sections" }).click();
    await expectNoAxeViolations(page, { exclude: EXCLUDE });
    await page.getByRole("button", { name: "Start directions" }).click();
    await expectNoAxeViolations(page, { exclude: EXCLUDE });
  });

  test("open dialogs and menus", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").waitFor();
    // While a modal is open the rest of the page is aria-hidden and inert, so scan the overlay itself.
    await expectNoAxeViolations(page, { include: "[role=dialog]" });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Change language/ }).click();
    await expectNoAxeViolations(page, { include: "[role=menu]" });
  });
});
