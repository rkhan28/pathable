import { TRIP, expect, test, useSettings } from "./fixtures";

test.beforeEach(async ({ page }) => useSettings(page, { theme: "light" }));

test("skip link is the first stop and moves focus to main", async ({ page }) => {
  await page.goto("/en-CA");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("route cards are a radio group: arrow keys change the route", async ({ page }) => {
  await page.goto(TRIP);
  const a = page.getByRole("radio", { name: /Route A/ });
  await a.waitFor();
  await a.focus();
  await expect(a).toBeChecked();
  await page.keyboard.press("ArrowDown");
  const second = page.locator("input.pa-route-radio").nth(1);
  await expect(second).toBeChecked();
  await expect(second).toBeFocused();
  await expect(page.locator(".pa-route-card.is-selected")).toHaveCount(1);
});

test("destination combobox works with keys and pasted coordinates", async ({ page }) => {
  await page.goto("/en-CA");
  const box = page.getByRole("combobox", { name: "Where to?" });
  await box.fill("43.76397, -79.49154");
  await expect(box).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await expect(box).toHaveAttribute("aria-activedescendant", /.+/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/navigate\?to=43\.76397%2C-79\.49154|\/navigate\?to=43\.76397,-79\.49154/);
});

test("geocoder results are reachable by keyboard", async ({ page }) => {
  await page.goto("/en-CA");
  const box = page.getByRole("combobox", { name: "Where to?" });
  await box.fill("Finch");
  await expect(page.getByRole("option", { name: /Finch West Station/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/navigate\?to=/);
});

test("onboarding moves focus to each step's heading", async ({ page }) => {
  await page.goto("/en-CA/onboarding");
  await page.getByRole("radio", { name: "Walker" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Your limits" })).toBeFocused();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "What to avoid" })).toBeFocused();
});

test("mobile sheet handle resizes with arrow keys", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the sheet only exists on small screens");
  await page.goto(TRIP);
  const handle = page.getByRole("button", { name: /Route panel/ });
  await expect(handle).toHaveAccessibleName(/half open/);
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await expect(handle).toHaveAccessibleName(/fully open/);
  await page.keyboard.press("End");
  await expect(handle).toHaveAccessibleName(/collapsed/);
});

test("command palette opens with the shortcut and navigates by keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut is a desktop affordance");
  await page.goto("/en-CA");
  const input = page.getByPlaceholder("Type a command or search");
  // On a slow machine the first press can land before the page is interactive; press again until it opens.
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await expect(input).toBeFocused();
  await input.fill("settings");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en-CA\/settings$/);
});
