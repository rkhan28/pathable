#!/usr/bin/env node
// Design-review screenshots: every surface at 390×844 and 1440×900, light and
// dark, against a running production server (real tiles, so the map shows).
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [round]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "../../docs/screenshots";
const round = process.argv[4] ?? "r1";
const pages = (process.env.PAGES ?? "landing,planner,details").split(",");
const ROUTES = {
  landing: "/en-CA",
  planner: "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154",
  details: "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154",
  onboarding: "/en-CA/onboarding",
  report: "/en-CA/report",
  settings: "/en-CA/settings",
  coverage: "/en-CA/coverage",
};
const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const scheme of ["light", "dark"]) {
  for (const size of SIZES) {
    const context = await browser.newContext({ viewport: size, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const name of pages) {
      await page.goto(base + ROUTES[name], { waitUntil: "networkidle" });
      await page.waitForFunction(() => {
        const m = document.querySelector("[data-map-status]");
        return !m || m.getAttribute("data-map-status") === "ready" || m.getAttribute("data-map-status") === "fallback-style";
      }, null, { timeout: 15000 }).catch(() => {});
      if (name === "details") {
        await page.getByRole("button", { name: /route details/i }).first().click();
      }
      await page.waitForTimeout(1500);
      const file = `${out}/${round}-${name}-${size.name}-${scheme}.png`;
      await page.screenshot({ path: file, fullPage: process.env.FULL === "1" && !["planner", "details"].includes(name) });
      console.log("wrote", file);
    }
    await context.close();
  }
}
await browser.close();
