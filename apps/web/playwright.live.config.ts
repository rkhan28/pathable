import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the full running stack: the production web image,
 * the API, PostGIS and object storage (`make up`). Nothing is stubbed except
 * the public geocoder, so results do not depend on a third party.
 */
export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: process.env.LIVE_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
