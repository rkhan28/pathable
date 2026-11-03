/** Lazy MapLibre loader: the library and its worker load only when a map mounts. */
import pkg from "maplibre-gl/package.json";

let loading: Promise<typeof import("maplibre-gl")> | null = null;

export function loadMapLibre() {
  loading ??= import("maplibre-gl").then((mod) => {
    const ml = (mod as { default?: typeof import("maplibre-gl") }).default ?? mod;
    // The worker is copied to public/vendor by scripts/copy-maplibre-worker.mjs.
    ml.setWorkerUrl(`/vendor/maplibre-gl-worker-${pkg.version}.mjs`);
    return ml;
  });
  return loading;
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
