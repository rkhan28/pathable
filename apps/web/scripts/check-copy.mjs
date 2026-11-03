#!/usr/bin/env node
// Fails on banned copy in UI messages: marketing filler, certainty claims,
// emoji, arrows appended to links, and middle-dot meta strings.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../src/messages/", import.meta.url));
const BANNED_WORDS = {
  "en-CA": [/\bseamless(ly)?\b/i, /\bempower/i, /\bunlock/i, /\brevolution/i, /\bcutting[- ]edge\b/i, /\b100% (safe|accessible)\b/i, /\bguarantee/i, /\bworld[- ]class\b/i],
  "fr-CA": [/\bsans (faille|couture)\b/i, /\brévolution/i, /\bde pointe\b/i, /\b100 ?% (sûr|accessible)/i, /\bgaranti/i],
};
const BANNED_CHARS = [
  [/(?![©®™])\p{Extended_Pictographic}/u, "emoji"],
  [/\s[→➜➔]\s*$|\s→/u, "arrow appended to text"],
  [/\S ·\s\S/u, "middle-dot meta string"],
];

const failures = [];
const walk = (obj, path, locale) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = path ? `${path}.${k}` : k;
    if (typeof v === "string") {
      for (const re of BANNED_WORDS[locale] ?? []) if (re.test(v)) failures.push(`${locale} ${key}: banned wording ${re}`);
      for (const [re, why] of BANNED_CHARS) if (re.test(v)) failures.push(`${locale} ${key}: ${why}`);
    } else walk(v, key, locale);
  }
};
for (const file of readdirSync(dir)) walk(JSON.parse(readFileSync(dir + file, "utf8")), "", file.replace(".json", ""));
if (failures.length) {
  console.error(`Copy check failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("Copy check passed.");
