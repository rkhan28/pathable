#!/usr/bin/env node
// MapLibre v6 loads its Web Worker from a URL next to the main module. Bundlers
// rename/relocate chunks, so we serve the worker as a static file instead and
// point MapLibre at it with setWorkerUrl() (see src/features/map/map-view.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const outDir = join(root, "public", "vendor", "maplibre");
mkdirSync(outDir, { recursive: true });
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join(outDir, "maplibre-gl-worker.mjs"));
console.log("✓ Copied MapLibre worker to public/vendor/maplibre/");
