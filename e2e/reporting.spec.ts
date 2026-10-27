import { expect, test } from "./fixtures";

// 64×48 PNG (solid grey) generated in-test so no binary fixture is needed.
async function makePng(page: import("@playwright/test").Page) {
  const base64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 64, 48);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

test.describe("barrier reporting", () => {
  test("full flow without a backend: honest analysis state and local draft", async ({ page }) => {
    await page.goto("/en/report");
    await expect(page.getByRole("heading", { name: "Add a photo" })).toBeVisible();

    await page.getByTestId("report-file-input").setInputFiles({ name: "curb.png", mimeType: "image/png", buffer: await makePng(page) });
    await expect(page.getByRole("img", { name: "Photo preview" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Location is required.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose a location to continue." })).toBeVisible();
    const search = page.getByRole("combobox", { name: "Search for an address" });
    await search.fill("Union");
    await search.press("Enter");
    await expect(page.getByText(/Selected location: Union Station/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Analysis: the ML service isn't connected, so nothing is invented.
    await page.getByRole("button", { name: "Analyze photo" }).click();
    await expect(page.getByText("Photo analysis isn't available")).toBeVisible();
    await expect(page.getByTestId("detection-overlay")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue" }).click();

    // Details: validation, then a valid report.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose the kind of barrier.")).toBeVisible();
    await page.getByRole("radio", { name: "Blocked curb ramp" }).check({ force: true });
    await page.getByLabel(/Description/).fill("Ramp blocked by a parked e-scooter.");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Check and send" })).toBeVisible();
    await expect(page.getByText("No AI analysis")).toBeVisible();
    await page.getByRole("button", { name: "Send report" }).click();

    await expect(page.getByRole("heading", { name: "Saved on this device — not sent" })).toBeFocused();
    await page.getByRole("link", { name: "View my reports" }).click();
    await expect(page).toHaveURL(/\/en\/settings#my-reports/);
    await expect(page.locator("#my-reports")).toContainText("Blocked curb ramp");
    await expect(page.locator("#my-reports")).toContainText("Not sent");
  });

  test("rejects non-image files with a clear error", async ({ page }) => {
    await page.goto("/en/report");
    await page.getByTestId("report-file-input").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByRole("alert").filter({ hasText: "Please choose" })).toHaveText("Please choose a JPEG, PNG, WebP or HEIC image.");
  });
});

test.describe("onboarding & settings", () => {
  test("onboarding sets a profile and display preferences that persist", async ({ page }) => {
    await page.goto("/en/onboarding");
    await page.getByRole("radio", { name: "Walker or rollator" }).check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Fine-tune what matters" })).toBeFocused();
    await expect(page.getByRole("switch", { name: "Avoid stairs" })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.getByRole("radio", { name: "150%" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("style", /--text-scale: 1.5/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start planning" }).click();
    await expect(page.getByText(/Planning for: Walker or rollator/)).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByText(/Planning for: Walker or rollator/)).toBeVisible();
  });

  test("skipping onboarding works and is remembered", async ({ page }) => {
    await page.goto("/en/onboarding");
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page).toHaveURL(/\/en\/navigate/);
    // Previously visited routes stay mounted but hidden (React <Activity>), so only count visible matches.
    await expect(page.getByText("Let's set up your routes").filter({ visible: true })).toHaveCount(0);
  });

  test("delete all data requires confirmation", async ({ page }) => {
    await page.goto("/en/settings");
    await page.getByRole("radio", { name: "Mobility scooter" }).check({ force: true });
    await page.getByRole("button", { name: "Delete all data on this device" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Delete all PathAble data on this device?");
    await dialog.getByRole("button", { name: "Delete everything" }).click();
    await expect(page.getByRole("radio", { name: "Custom" })).toBeChecked();
  });
});
