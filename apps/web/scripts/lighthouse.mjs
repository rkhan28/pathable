#!/usr/bin/env node
// Lighthouse gate for the landing page against a running production server.
// Usage: node scripts/lighthouse.mjs [baseUrl]. Writes docs/lighthouse/*.json.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3300";
const runs = [
  { name: "mobile", args: [], min: { performance: 85 } },
  { name: "desktop", args: ["--preset=desktop"], min: { performance: 95 } },
];
let failed = false;
for (const run of runs) {
  const out = `../../docs/lighthouse/landing-${run.name}.json`;
  execFileSync("npx", ["lighthouse", `${base}/en-CA`, ...run.args, "--quiet", "--output=json", `--output-path=${out}`, "--chrome-flags=--headless=new --no-sandbox"], {
    env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    stdio: "ignore",
  });
  const r = JSON.parse(readFileSync(out, "utf8"));
  const score = (k) => Math.round(r.categories[k].score * 100);
  const cls = r.audits["cumulative-layout-shift"].numericValue;
  const row = { performance: score("performance"), accessibility: score("accessibility"), cls: cls.toFixed(4), lcpMs: Math.round(r.audits["largest-contentful-paint"].numericValue), tbtMs: Math.round(r.audits["total-blocking-time"].numericValue) };
  const ok = row.performance >= run.min.performance && row.accessibility === 100 && cls < 0.001;
  failed ||= !ok;
  console.log(ok ? "pass" : "FAIL", run.name, JSON.stringify(row));
}
process.exit(failed ? 1 : 0);
