#!/usr/bin/env node
// Reads colour tokens from src/styles/tokens.css and fails when any declared
// foreground/background pair is below WCAG 2.2 AA (1.4.3 text, 1.4.11 non-text).
// High-contrast themes are held to 7:1 for text (1.4.6, AAA).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)), "utf8");

/** @returns {Map<string, Record<string,string>>} theme name -> tokens */
export function parseThemes(source) {
  const themes = new Map();
  const marker = /\/\*\s*@theme\s+([\w-]+)(?:\s+extends\s+([\w-]+))?\s*\*\//g;
  let match;
  while ((match = marker.exec(source))) {
    const [, name, base] = match;
    // The block that follows the marker: skip selectors and any @media wrapper.
    let depth = 0;
    let start = -1;
    let end = -1;
    for (let i = marker.lastIndex; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") {
        depth++;
        start = i;
      } else if (ch === "}") {
        end = i;
        break;
      }
    }
    if (start < 0 || end < 0 || depth === 0) throw new Error(`Unterminated theme block ${name}`);
    const tokens = { ...(base ? themes.get(base) : {}), ...(themes.get(name) ?? {}) };
    for (const [, key, value] of source.slice(start + 1, end).matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      tokens[key] = value.toLowerCase();
    }
    themes.set(name, tokens);
  }
  return themes;
}

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["surface", "surface-raised", "surface-sunken"];
const TEXT = ["ink", "ink-muted", "brand", "state-verified", "state-barrier", "state-unverified", "state-unknown", "winter"];
const STATE_LINES = ["state-verified", "state-barrier", "state-unverified", "state-unknown", "signal", "route-alt"];

/** Pairs every theme must pass: [foreground, background, minimum, reason] */
function pairsFor(theme) {
  const more = theme.endsWith("-more");
  const pairs = [];
  for (const fg of TEXT) for (const bg of SURFACES) pairs.push([fg, bg, more ? 7 : 4.5, "text"]);
  pairs.push(["on-brand", "brand", more ? 7 : 4.5, "text on brand fill"]);
  pairs.push(["on-signal", "signal", 4.5, "text on primary action"]);
  pairs.push(["on-attention", "attention", 4.5, "text on attention fill"]);
  for (const bg of ["surface", "surface-raised"]) {
    pairs.push(["line", bg, 3, "control boundary"]);
    pairs.push(["signal", bg, 3, "primary action boundary"]);
    pairs.push(["focus", bg, 3, "focus indicator"]);
  }
  for (const fg of STATE_LINES) pairs.push([fg, "route-casing", 3, "route line on its casing"]);
  return pairs;
}

export function check(themes) {
  const failures = [];
  let checked = 0;
  for (const [theme, tokens] of themes) {
    for (const [fg, bg, min, reason] of pairsFor(theme)) {
      if (!(fg in tokens) || !(bg in tokens)) {
        failures.push(`${theme}: missing token --${!(fg in tokens) ? fg : bg}`);
        continue;
      }
      const ratio = contrast(tokens[fg], tokens[bg]);
      checked++;
      if (ratio < min) failures.push(`${theme}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1 (${reason})`);
    }
  }
  return { failures, checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const themes = parseThemes(css);
  const { failures, checked } = check(themes);
  if (failures.length) {
    console.error(`Contrast check failed (${failures.length} of ${checked} pairs):\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`Contrast check passed: ${checked} pairs across ${themes.size} themes (${[...themes.keys()].join(", ")}).`);
}
