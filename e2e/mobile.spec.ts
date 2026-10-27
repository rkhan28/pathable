import { expect, noHorizontalOverflow, test, TRIP_QUERY } from "./fixtures";

const PAGES = ["/en", "/en/navigate", `/en/navigate?${TRIP_QUERY}`, "/en/onboarding", "/en/report", "/en/settings", "/en/help", "/en/coverage", "/fr", "/fr/settings"];

test.describe("mobile layout", () => {
  for (const path of PAGES) {
    test(`no horizontal scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await noHorizontalOverflow(page);
    });
  }

  test("no horizontal scrolling at 150% text size", async ({ page }) => {
    await page.goto("/en");
    await page.evaluate(() => {
      localStorage.setItem("pathable:preferences", JSON.stringify({ state: { display: { textScale: 1.5 } }, version: 1 }));
    });
    for (const path of ["/en", "/en/settings", `/en/navigate?${TRIP_QUERY}`, "/en/report"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("style", /--text-scale: 1.5/);
      await noHorizontalOverflow(page);
    }
  });

  test("right-to-left layout doesn't overflow (RTL readiness for Arabic/Urdu)", async ({ page }) => {
    for (const path of ["/en", `/en/navigate?${TRIP_QUERY}`, "/en/settings"]) {
      await page.goto(path);
      await page.evaluate(() => (document.documentElement.dir = "rtl"));
      await noHorizontalOverflow(page);
    }
  });

  test("bottom sheet can be expanded and collapsed without dragging", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    const handle = page.getByRole("button", { name: /Show (more|less)/ });
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await handle.focus();
    await page.keyboard.press("ArrowDown");
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(handle).toHaveAccessibleName("Show less");
  });

  test("touch targets are at least 44×44 CSS px", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, a[href], [role=radio], [role=switch], input:not([type=hidden]):not(.sr-only)")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || el.closest(".maplibregl-ctrl-attrib, .sr-only")) return false;
          // Inline text links inside sentences are exempt (WCAG 2.5.8 inline exception).
          if (el.tagName === "A" && style.display === "inline") return false;
          return r.width < 44 - 0.5 || r.height < 36 - 0.5;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`),
    );
    expect(small).toEqual([]);
  });
});
