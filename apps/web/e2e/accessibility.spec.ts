import { TRIP, expect, expectNoAxeViolations, test, useSettings, type Settings } from "./fixtures";

const PAGES = ["", "/navigate", "/settings", "/onboarding", "/report", "/coverage", "/help", "/accessibility", "/ai", "/contact", "/privacy", "/terms", "/does-not-exist"];
const THEMES: [string, Settings][] = [
  ["light", { theme: "light" }],
  ["dark", { theme: "dark" }],
  ["light high contrast", { theme: "light", contrast: "more" }],
  ["dark high contrast", { theme: "dark", contrast: "more" }],
];

test.describe("axe: every page, both languages, every theme", () => {
  test.skip(({ isMobile }) => isMobile, "theme matrix runs once, on desktop");
  for (const locale of ["en-CA", "fr-CA"]) {
    for (const [name, settings] of THEMES) {
      for (const path of PAGES) {
        test(`${locale}${path || "/"} ${name}`, async ({ page }) => {
          await useSettings(page, settings);
          await page.goto(`/${locale}${path}`);
          await page.waitForLoadState("networkidle");
          await expectNoAxeViolations(page, `${locale}${path} ${name}`);
        });
      }
    }
  }
});

test.describe("axe: open states", () => {
  test("route list, details tabs and guidance", async ({ page }) => {
    await useSettings(page, { theme: "light" });
    await page.goto(TRIP);
    await page.getByRole("radio", { name: /Route A/ }).waitFor();
    await expectNoAxeViolations(page, "route list");
    await page.getByRole("radio", { name: /^Transit/ }).click();
    await page.getByRole("radio", { name: /Arrive/ }).first().waitFor();
    await expectNoAxeViolations(page, "transit options");
    await page.getByRole("radio", { name: /^Walk/ }).click();
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByRole("button", { name: "Why this route?" }).click();
    await expectNoAxeViolations(page, "directions and why this route");
    await page.getByRole("tab", { name: "Sections" }).click();
    await expectNoAxeViolations(page, "sections");
    await page.getByRole("tab", { name: "Hazards" }).click();
    await expectNoAxeViolations(page, "hazards");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const guidance = page.getByRole("region", { name: "Guidance" });
    await guidance.waitFor();
    // The bar slides and fades in; contrast measured mid-fade would blend it with the map behind.
    await guidance.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    await expect(page.locator(".pa-nav-bar")).toHaveCSS("opacity", "1");
    await expectNoAxeViolations(page, "guidance");
  });

  test("language menu and destination options", async ({ page, isMobile }) => {
    await useSettings(page, { theme: "dark" });
    await page.goto("/en-CA");
    await page.getByRole("button", { name: /Language/ }).click();
    await expectNoAxeViolations(page, "language menu");
    await page.keyboard.press("Escape");
    if (isMobile) {
      await page.getByRole("button", { name: "Menu" }).click();
      await expectNoAxeViolations(page, "mobile menu");
      await page.keyboard.press("Escape");
    }
    await page.getByRole("combobox", { name: "Where to?" }).click();
    await expectNoAxeViolations(page, "combobox open");
  });

  test("delete-all confirmation", async ({ page }) => {
    await useSettings(page, { theme: "light", contrast: "more" });
    await page.goto("/en-CA/settings");
    await page.getByRole("button", { name: "Delete all data on this device" }).click();
    await expectNoAxeViolations(page, "alert dialog");
  });
});

test("axe: command palette open", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop shortcut");
  await useSettings(page, { theme: "dark" });
  await page.goto("/en-CA");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Type a command or search").waitFor();
  await expectNoAxeViolations(page, "command palette");
});
