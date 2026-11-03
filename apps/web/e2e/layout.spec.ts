import { TRIP, expect, test, useSettings } from "./fixtures";

const PAGES = ["/en-CA", TRIP, "/en-CA/settings", "/en-CA/onboarding", "/en-CA/report", "/en-CA/coverage", "/en-CA/help", "/fr-CA", "/fr-CA/coverage"];

test.describe("no horizontal scrolling at 390 px and 150% text", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await useSettings(page, { theme: "light", textScale: 1.5 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("touch targets are at least 44 px", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");
  for (const path of ["/en-CA", TRIP, "/en-CA/settings", "/en-CA/onboarding"]) {
    test(path, async ({ page }) => {
      await useSettings(page, { theme: "light" });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Inline links inside sentences are exempt (WCAG 2.5.8 inline exception).
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, [role=button], input[type=radio], [role=tab], [role=combobox], select, .pa-link-button, .pa-nav-link")]
          .filter((el) => el.offsetParent !== null && !el.closest("[inert]") && !el.classList.contains("sr-only") && getComputedStyle(el).opacity !== "0")
          .map((el) => {
            const target = el.matches("input[type=radio]") ? el.closest("label, .pa-route-card") ?? el : el;
            const r = target.getBoundingClientRect();
            return { name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
          })
          .filter((t) => t.w < 44 || t.h < 44),
      );
      expect(small).toEqual([]);
    });
  }
});
