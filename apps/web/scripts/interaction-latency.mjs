#!/usr/bin/env node
// Measures how long real interactions take to paint (Event Timing API, the
// basis of INP) on the planner, with the CPU throttled 4x to approximate a
// mid-range Android phone. Usage: node scripts/interaction-latency.mjs [baseUrl]
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const TRIP = "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154";
const browser = await chromium.launch({ channel: "chromium", args: process.env.NO_WEBGL ? ["--disable-webgl", "--disable-webgl2"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = {};

async function measure(name, ctxOptions, steps) {
  const ctx = await browser.newContext(ctxOptions);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__interactions = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.interactionId) continue;
        const t = e.target;
        const label = t ? (t.getAttribute?.("aria-label") || t.textContent || t.tagName || "").trim().slice(0, 40) : "";
        window.__interactions.push({ name: e.name, duration: e.duration, target: label });
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  await page.goto(base + TRIP);
  await page.getByRole("radio", { name: /Route A/ }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await steps(page);
  await page.waitForTimeout(800);
  const events = await page.evaluate(() => window.__interactions);
  const durations = events.map((e) => e.duration).sort((a, b) => a - b);
  const p = (q) => durations[Math.min(durations.length - 1, Math.floor(q * durations.length))] ?? 0;
  results[name] = { interactions: events.length, p50: p(0.5), p75: p(0.75), max: durations.at(-1) ?? 0, slowest: events.filter((e) => e.name === "click" || e.name === "keydown").sort((a, b) => b.duration - a.duration).slice(0, 6) };
  await ctx.close();
}

await measure("desktop", { viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.getByRole("radio", { name: /Route A/ }).focus();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: "Why this route?" }).click();
  await page.getByRole("button", { name: "Route details" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("tab", { name: "Sections" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Hazards" }).click();
  await page.getByRole("tab", { name: "Directions" }).click();
  await page.getByRole("button", { name: "Start guidance" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(600);
  await page.keyboard.type("set");
  await page.keyboard.press("Escape");
});

await measure("mobile", { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, ...(process.env.DPR ? { deviceScaleFactor: Number(process.env.DPR) } : {}) }, async (page) => {
  const handle = page.getByRole("button", { name: /Route panel/ });
  await handle.click();
  await page.waitForTimeout(600);
  await handle.click();
  await page.waitForTimeout(600);
  await page.getByRole("radio").nth(1).check();
  await page.waitForTimeout(400);
  await handle.click();
  await page.waitForTimeout(600);
});

console.log(JSON.stringify(results, null, 1));
await browser.close();
