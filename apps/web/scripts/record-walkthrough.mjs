#!/usr/bin/env node
// Records the signature moments against a running production build, using
// the real fixtures and real tiles. Writes a webm plus a JSON of moment
// timestamps; scripts/cut-media.sh turns them into an mp4 and per-moment GIFs.
// Usage: node scripts/record-walkthrough.mjs [baseUrl]
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const out = new URL("../../../docs/media/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const TRIP = "/en-CA/navigate?from=43.77412,-79.49963&to=43.76397,-79.49154";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const moments = [];
let t0 = 0;
const mark = (name) => moments.push({ name, at: (Date.now() - t0) / 1000 });

async function session(name, viewport, script) {
  const context = await browser.newContext({ viewport, colorScheme: "light", recordVideo: { dir: out, size: viewport } });
  await context.addInitScript(() => localStorage.setItem("pathable:settings", JSON.stringify({ state: { motion: "full" }, version: 1 })));
  const page = await context.newPage();
  t0 = Date.now();
  await script(page);
  await context.close();
  renameSync(await page.video().path(), `${out}${name}.webm`);
}

await session("walkthrough-desktop", { width: 1440, height: 900 }, async (page) => {
  mark("hero");
  await page.goto(`${base}/en-CA`, { waitUntil: "networkidle" });
  await pause(3500);
  mark("profiles");
  for (const name of ["Walker", "Blind or low vision", "Manual wheelchair"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await pause(2200);
  }
  mark("states");
  await page.locator("#states-title").scrollIntoViewIfNeeded();
  await pause(800);
  for (const state of ["Verified", "Barrier", "No data"]) {
    await page.locator(".pa-specimen-row", { hasText: state }).first().click();
    await pause(1600);
  }
  mark("compare");
  await page.goto(`${base}${TRIP}`, { waitUntil: "networkidle" });
  await pause(3000);
  const first = page.getByRole("radio", { name: /Route A/ });
  await first.focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("ArrowDown");
    await pause(2200);
  }
  await page.keyboard.press("ArrowDown");
  await pause(1500);
  await page.getByRole("button", { name: "Why this route?" }).click();
  await pause(2500);
  mark("details");
  await page.getByRole("button", { name: "Route details" }).click();
  await pause(2500);
  await page.getByRole("tab", { name: "Sections" }).click();
  await pause(2500);
  await page.getByRole("tab", { name: "Directions" }).click();
  await page.getByRole("button", { name: /Show on map/ }).nth(2).click();
  await pause(2500);
  mark("guidance");
  await page.getByRole("button", { name: "Start guidance" }).click();
  await pause(2000);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Next step" }).click();
    await pause(1800);
  }
  await page.keyboard.press("Escape");
  mark("palette");
  await page.keyboard.press("ControlOrMeta+k");
  await pause(800);
  await page.keyboard.type("settings", { delay: 90 });
  await pause(700);
  await page.keyboard.press("Enter");
  await page.waitForURL(/settings/);
  await pause(1200);
  mark("settings");
  await page.getByRole("radio", { name: "Dark" }).check();
  await pause(1500);
  await page.getByRole("radio", { name: "More contrast" }).check();
  await pause(1500);
  await page.getByRole("radio", { name: "Standard" }).check();
  await page.getByRole("radio", { name: "Light" }).check();
  await pause(800);
  mark("end");
});
const desktopMoments = moments.splice(0);

await session("walkthrough-mobile", { width: 390, height: 844 }, async (page) => {
  mark("sheet");
  await page.goto(`${base}${TRIP}`, { waitUntil: "networkidle" });
  await pause(3000);
  const handle = page.getByRole("button", { name: /Route panel/ });
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await pause(1800);
  await page.keyboard.press("End");
  await pause(1800);
  // A real drag with velocity: pull the collapsed sheet up quickly.
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - i * 45);
    await pause(16);
  }
  await page.mouse.up();
  await pause(2200);
  mark("end");
});

writeFileSync(`${out}moments.json`, JSON.stringify({ desktop: desktopMoments, mobile: moments }, null, 2) + "\n");
await browser.close();
console.log("recorded", JSON.stringify({ desktop: desktopMoments.map((m) => m.name), mobile: moments.map((m) => m.name) }));
