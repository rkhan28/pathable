#!/usr/bin/env node
// Copies the shared contract fixtures into the app so the web build does not
// reach outside apps/web (Vercel builds this directory on its own).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const from = fileURLToPath(new URL("../../../contracts/fixtures/", import.meta.url));
const to = fileURLToPath(new URL("../src/generated/fixtures/", import.meta.url));
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith("scoring-inputs.json") });
// The measured coverage numbers shown on the site come from the data report, not from copy.
cpSync(fileURLToPath(new URL("../../../docs/data/reality_check.json", import.meta.url)), fileURLToPath(new URL("../src/generated/reality-check.json", import.meta.url)));
// The coverage page shows the pipeline's own map.
mkdirSync(fileURLToPath(new URL("../public/data/", import.meta.url)), { recursive: true });
cpSync(fileURLToPath(new URL("../../../docs/data/map_osm_sidewalk_ratio.png", import.meta.url)), fileURLToPath(new URL("../public/data/map_osm_sidewalk_ratio.png", import.meta.url)));
console.log("synced contracts/fixtures and docs/data/reality_check.json -> src/generated/");
