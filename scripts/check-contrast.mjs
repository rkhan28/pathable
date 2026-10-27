#!/usr/bin/env node
/**
 * Verifies WCAG 2.2 contrast for every text/background token pair PathAble uses.
 * Reads the raw tokens from src/app/globals.css so the check can't drift from the source.
 *   Normal text  ≥ 4.5:1 (SC 1.4.3)
 *   UI / graphics ≥ 3:1  (SC 1.4.11)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/app/globals.css", import.meta.url)), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No block for ${selector}`);
  const end = css.indexOf("}", start);
  const vars = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXT = 4.5;
const UI = 3;
const textOn = ["bg", "bg-subtle", "surface", "surface-raised"];
const textTokens = ["fg", "fg-muted", "fg-subtle", "verified", "barrier", "unverified", "unknown", "winter", "info", "accent-text"];
const pairs = [
  ["primary-fg", "primary", TEXT],
  ["fg", "accent-soft", TEXT],
  ["verified", "verified-soft", TEXT],
  ["barrier", "barrier-soft", TEXT],
  ["unverified", "unverified-soft", TEXT],
  ["unknown", "unknown-soft", TEXT],
  ["winter", "winter-soft", TEXT],
  ["info", "info-soft", TEXT],
  ["focus", "bg", UI],
  ["focus", "surface", UI],
  ["border-strong", "surface", UI],
  ["map-route-selected", "bg", UI],
];

const themes = {
  light: block(":root"),
};
themes.dark = { ...themes.light, ...block(".dark") };
themes["high-contrast"] = { ...themes.light, ...block('[data-contrast="high"]') };
themes["high-contrast dark"] = { ...themes.dark, ...block('.dark[data-contrast="high"]') };

let failures = 0;
for (const [name, t] of Object.entries(themes)) {
  // resolve var() aliases used in :root (primary: var(--forest) etc.)
  const resolve = (k) => {
    if (t[k]) return t[k];
    const m = css.match(new RegExp(`--${k}:\\s*var\\(--([\\w-]+)\\)`));
    return m ? resolve(m[1]) : undefined;
  };
  t["accent-text"] = resolve("accent");
  const rows = [];
  for (const fg of textTokens) for (const bg of textOn) rows.push([fg, bg, TEXT]);
  rows.push(...pairs);
  for (const [a, b, min] of rows) {
    const ca = resolve(a);
    const cb = resolve(b);
    if (!ca || !cb) continue;
    const r = ratio(ca, cb);
    if (r < min) {
      failures++;
      console.log(`✗ [${name}] ${a} on ${b}: ${r.toFixed(2)} (needs ${min})`);
    }
  }
}
if (failures) {
  console.log(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log("✓ All token pairs meet WCAG 2.2 AA contrast.");
