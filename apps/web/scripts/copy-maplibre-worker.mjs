#!/usr/bin/env node
// MapLibre v6 loads its worker from a URL relative to its own module, which
// bundlers rewrite. Serve the worker as a static file and point setWorkerUrl()
// at it (src/components/map/maplibre.ts).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const candidates = ["dist/maplibre-gl-worker.mjs", "dist/maplibre-gl-csp-worker.js", "dist/maplibre-gl-worker.js"];
const source = candidates.map((c) => join(pkgDir, c)).find(existsSync);
if (!source) throw new Error(`No MapLibre worker found in ${pkgDir}/dist`);
const outDir = fileURLToPath(new URL("../public/vendor/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const ext = source.endsWith(".mjs") ? "mjs" : "js";
copyFileSync(source, join(outDir, `maplibre-gl-worker-${version}.${ext}`));
console.log(`copied ${source} -> public/vendor/maplibre-gl-worker-${version}.${ext}`);
