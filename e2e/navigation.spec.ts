import { expect, test, TRIP_QUERY } from "./fixtures";

test.describe("route planning", () => {
  test("shows ranked, clearly-labelled sample routes", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await expect(page.getByRole("heading", { name: "3 routes found" })).toBeVisible();
    await expect(page.getByTestId("sample-data-notice")).toContainText("Sample data, not for navigation");
    const options = page.getByRole("radiogroup", { name: "Route options" }).getByRole("radio");
    await expect(options).toHaveCount(3);
    await expect(options.first()).toBeChecked();
    await expect(options.first()).toHaveAccessibleName(/Option 1, Suggested/);
    await expect(page.getByRole("region", { name: "Why this route?" })).toBeVisible();
    // Never claims certainty it doesn't have.
    await expect(page.locator("body")).not.toContainText(/100% safe(?! routes)/i);
  });

  test("announces results to screen readers", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await expect(page.getByTestId("live-polite")).toContainText(/3 routes found\. Suggested route: .+, about .+\./);
  });

  test("route options are keyboard operable with arrow keys", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    const options = page.getByRole("radio");
    await options.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toBeChecked();
    await expect(options.nth(1)).toBeFocused();
    await expect(page.getByTestId("live-polite")).toContainText("Route 2 selected");
  });

  test("details tabs and step-by-step guidance", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await page.getByRole("button", { name: "Route details" }).click();
    await expect(page.getByRole("heading", { name: /Route details: Option 1/ })).toBeFocused();
    await page.getByRole("tab", { name: "Sections" }).click();
    await expect(page.getByRole("tabpanel")).toContainText(/Known accessible|No data/);
    await page.getByRole("tab", { name: /Hazards/ }).click();
    await page.getByRole("tab", { name: "Directions" }).click();
    await expect(page.getByRole("list", { name: "Step-by-step directions" }).getByRole("listitem").first()).toContainText("Head out");

    await page.getByRole("button", { name: "Start directions" }).click();
    await expect(page.getByRole("heading", { name: "Directions" })).toBeFocused();
    await expect(page.getByText("These are sample directions. Don't follow them outdoors.")).toBeVisible();
    await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "End directions" }).click();
    await page.getByRole("button", { name: "All routes" }).click();
    await expect(page.getByRole("heading", { name: "3 routes found" })).toBeVisible();
  });

  test("changing preferences re-ranks routes live", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await page.getByRole("button", { name: "Change preferences" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("label").filter({ hasText: "Manual wheelchair" }).click();
    await expect(dialog.getByRole("radio", { name: "Manual wheelchair" })).toBeChecked();
    await expect(dialog.getByRole("switch", { name: "Avoid stairs" })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Planning for: Manual wheelchair/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "3 routes found" })).toBeVisible();
  });

  test("switching language keeps the trip and selected route", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    const options = page.getByRole("radio");
    await options.nth(2).check({ force: true });
    await page.getByRole("button", { name: /Change language/ }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/navigate\?from=/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-CA");
    await expect(page.getByRole("heading", { name: "3 itinéraires trouvés" })).toBeVisible();
    await expect(page.getByRole("radio").nth(2)).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Départ" })).toHaveValue("Union Station");
  });

  test("address search is a keyboard-operable combobox", async ({ page }) => {
    await page.goto("/en/navigate");
    const to = page.getByRole("combobox", { name: "To" });
    await to.fill("St. Law");
    const listbox = page.getByRole("listbox", { name: "To" });
    await expect(listbox.getByRole("option", { name: /St\. Lawrence Market/ })).toBeVisible();
    await to.press("ArrowDown"); // use my location
    await to.press("ArrowDown"); // first result
    await expect(to).toHaveAttribute("aria-activedescendant", /opt-1/);
    await to.press("Enter");
    await expect(to).toHaveValue("St. Lawrence Market");

    const from = page.getByRole("combobox", { name: "From" });
    await from.fill("Union");
    await from.press("Enter");
    await expect(from).toHaveValue("Union Station");
    await expect(page.getByRole("heading", { name: "3 routes found" })).toBeVisible();
  });

  test("swap exchanges start and destination", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await page.getByRole("button", { name: "Swap start and destination" }).click();
    await expect(page.getByRole("combobox", { name: "From" })).toHaveValue("St. Lawrence Market");
    await expect(page.getByRole("combobox", { name: "To" })).toHaveValue("Union Station");
  });

  test("map degrades gracefully when tiles can't load", async ({ page }) => {
    await page.goto(`/en/navigate?${TRIP_QUERY}`);
    await expect(page.getByText("Map tiles couldn't load. Directions and route details are still available in the panel.")).toBeVisible({ timeout: 20_000 });
    // Route information remains fully available as text.
    await expect(page.getByRole("radio")).toHaveCount(3);
  });

  test("outside the coverage area produces a clear message", async ({ page }) => {
    await page.goto("/en/navigate?from=43.6453,-79.3806&to=45.4215,-75.6972");
    await expect(page.getByRole("alert").filter({ hasText: "outside the area PathAble covers" })).toBeVisible();
  });
});

test.describe("landing page", () => {
  test("hero search hands the destination to the planner", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A city without limits begins with a better route.");
    const search = page.getByRole("combobox", { name: "Where would you like to go?" });
    await search.fill("St. Law");
    await page.getByRole("option", { name: /St\. Lawrence Market/ }).click();
    await expect(page).toHaveURL(/\/en\/navigate$/);
    await expect(page.getByRole("combobox", { name: "To" })).toHaveValue("St. Lawrence Market");
  });

  test("interactive hero re-routes by profile", async ({ page }) => {
    await page.goto("/en");
    const group = page.getByRole("radiogroup", { name: "Show the route for" });
    await group.getByRole("radio", { name: /Cane/ }).click();
    await expect(page.getByText("Shortest route, with stairs.", { exact: true })).toBeVisible();
    await group.getByRole("radio", { name: /Manual chair/ }).click();
    await expect(page.getByText("Longest route, fully verified.", { exact: true })).toBeVisible();
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("command palette navigates by keyboard", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("combobox", { name: "Where would you like to go?" })).toBeEditable();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Search actions" })).toBeVisible();
    await page.keyboard.type("settings");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/settings$/);
  });
});
