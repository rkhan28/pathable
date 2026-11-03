import { createHttpService } from "./http-service";
import type { PathAbleService } from "./service";
import { unavailableService } from "./unavailable-service";

const API_URL = process.env.NEXT_PUBLIC_PATHABLE_API_URL || "";
/** Fixtures default on in `next dev`, off in production unless explicitly enabled for a demo. */
export const FIXTURES_ENABLED =
  process.env.NEXT_PUBLIC_DEV_FIXTURES === "true" ||
  (process.env.NEXT_PUBLIC_DEV_FIXTURES !== "false" && process.env.NODE_ENV === "development");

let cached: Promise<PathAbleService> | null = null;

export function getService(): Promise<PathAbleService> {
  cached ??= (async () => {
    if (API_URL) return createHttpService(API_URL);
    if (FIXTURES_ENABLED) return (await import("./fixture-service")).fixtureService;
    return unavailableService;
  })();
  return cached;
}

export function serviceKind(): PathAbleService["kind"] {
  return API_URL ? "live" : FIXTURES_ENABLED ? "development-fixture" : "unavailable";
}
