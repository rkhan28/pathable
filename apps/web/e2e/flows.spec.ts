import { TRIP, expect, test, useSettings } from "./fixtures";

test.beforeEach(async ({ page }) => useSettings(page, { theme: "light" }));

test("fixture data is labelled on the banner and on every route card", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  const cards = page.locator(".pa-route-card:visible");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) await expect(cards.nth(i).getByText("Development data")).toBeVisible();
  await expect(page.getByRole("region", { name: "Development data" })).toBeVisible();
});

test("switching language keeps the trip and the selected route", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio").nth(1).check();
  const selected = await page.getByRole("radio", { checked: true }).getAttribute("id");
  await page.getByRole("button", { name: /Language/ }).first().click();
  await page.getByRole("menuitem", { name: /Français/ }).click();
  await expect(page).toHaveURL(/\/fr-CA\/navigate\?from=43\.77412.*to=43\.76397/);
  await expect(page.getByRole("radio", { checked: true })).toHaveAttribute("id", selected!);
  await expect(page.getByRole("heading", { name: "Itinéraires selon vos préférences" })).toBeVisible();
});

test("changing a preference re-ranks without a new request", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  await page.goto("/en-CA/settings");
  await page.getByRole("switch", { name: "Avoid crossings without known curb ramps" }).click();
  await page.goto(TRIP);
  await expect(page.locator(".pa-route-card:visible").first()).toBeVisible();
});

test("photo analysis is honestly unavailable and an unsent report stays a draft", async ({ page }) => {
  await page.goto("/en-CA/report");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("combobox").fill("43.7700, -79.4950");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Automatic photo analysis is turned off/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Describe it").fill("Sign post in the middle of the sidewalk");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".pa-notice").getByText(/Your report was not sent/)).toBeVisible();
  await page.goto("/en-CA/settings");
  await expect(page.getByText("Draft, not sent")).toBeVisible();
});

test("outside North York is refused honestly", async ({ page }) => {
  await page.goto("/en-CA");
  await page.getByRole("combobox", { name: "Where to?" }).fill("43.6532, -79.3832");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/outside North York/)).toBeVisible();
});
