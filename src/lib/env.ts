import { z } from "zod";

/**
 * Public runtime configuration. Everything here is NEXT_PUBLIC_* and therefore
 * visible to the browser — never put secrets in these variables.
 */
const EnvSchema = z.object({
  /** Base URL of the PathAble API (e.g. https://api.pathable.ca). Unset = no backend. */
  apiUrl: z.url().optional(),
  /**
   * Allow clearly-labelled development fixtures when the API is unset.
   * Defaults to true in development, false in production builds.
   */
  devFixtures: z.boolean(),
  /** MapLibre style URLs. Default: OpenFreeMap (OSM data, no API key). */
  mapStyleLight: z.url(),
  mapStyleDark: z.url(),
  /** Photon-compatible geocoder (https://github.com/komoot/photon). */
  geocoderUrl: z.url(),
  /** Public support channel, e.g. a GitHub issues URL. Unset = hide contact links. */
  supportUrl: z.url().optional(),
  repoUrl: z.url().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

const emptyToUndefined = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

export const env: AppEnv = EnvSchema.parse({
  apiUrl: emptyToUndefined(process.env.NEXT_PUBLIC_PATHABLE_API_URL),
  devFixtures: readBoolean(process.env.NEXT_PUBLIC_DEV_FIXTURES, process.env.NODE_ENV !== "production"),
  mapStyleLight: emptyToUndefined(process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT) ?? "https://tiles.openfreemap.org/styles/positron",
  mapStyleDark: emptyToUndefined(process.env.NEXT_PUBLIC_MAP_STYLE_DARK) ?? "https://tiles.openfreemap.org/styles/dark",
  geocoderUrl: emptyToUndefined(process.env.NEXT_PUBLIC_GEOCODER_URL) ?? "https://photon.komoot.io",
  supportUrl: emptyToUndefined(process.env.NEXT_PUBLIC_SUPPORT_URL),
  repoUrl: emptyToUndefined(process.env.NEXT_PUBLIC_REPO_URL),
});

/** How the app is talking to the backend right now. Drives the honesty banners. */
export type BackendMode = "live" | "fixtures" | "unavailable";

export function getBackendMode(e: AppEnv = env): BackendMode {
  if (e.apiUrl) return "live";
  if (e.devFixtures) return "fixtures";
  return "unavailable";
}
