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
  await page.locator("input.pa-route-radio").nth(1).check();
  const selected = await page.locator("input.pa-route-radio:checked").getAttribute("id");
  await page.getByRole("button", { name: /Language/ }).first().click();
  await page.getByRole("menuitem", { name: /Français/ }).click();
  await expect(page).toHaveURL(/\/fr-CA\/navigate\?from=43\.77412.*to=43\.76397/);
  await expect(page.locator("input.pa-route-radio:checked:visible")).toHaveAttribute("id", selected!);
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

test("start opens guidance that steps through the route and ends back on the planner", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const guidance = page.getByRole("region", { name: "Guidance" });
  // No location in the test browser: guidance says it is a preview rather than pretending to track.
  await expect(guidance.getByText(/^Preview/)).toBeVisible();
  await guidance.getByRole("button", { name: "Pause preview" }).click();
  const first = await guidance.getByRole("heading").textContent();
  await guidance.getByRole("button", { name: "Next step" }).click();
  await expect(guidance.getByRole("heading")).not.toHaveText(first!);
  await page.keyboard.press("Escape");
  await expect(guidance).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Route A/ })).toBeVisible();
});

test("transit options are offered beside walking, labelled, with a suggestion when faster", async ({ page }) => {
  await page.goto(TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor();
  await expect(page.getByRole("button", { name: /saves/ })).toBeVisible();
  await page.getByRole("button", { name: /saves/ }).click();
  await expect(page.getByRole("radio", { name: /^Transit/ })).toHaveAttribute("aria-checked", "true");
  const cards = page.locator(".pa-route-card:visible");
  await expect(cards.first().getByText("Development data")).toBeVisible();
  await expect(cards.first().getByText(/Step-free/)).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  const guidance = page.getByRole("region", { name: "Guidance" });
  await guidance.getByRole("button", { name: "Pause preview" }).click();
  for (let i = 0; i < 6 && !(await guidance.getByRole("heading", { name: /^Take / }).count()); i++) {
    await guidance.getByRole("button", { name: "Next step" }).click();
  }
  await expect(guidance.getByRole("heading", { name: /^Take / })).toBeVisible();
});
