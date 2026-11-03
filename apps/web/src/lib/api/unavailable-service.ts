import { PathAbleError } from "./errors";
import type { PathAbleService } from "./service";

/** Used when no API is configured and fixtures are off: every call says so honestly. */
export const unavailableService: PathAbleService = {
  kind: "unavailable",
  routes: () => Promise.reject(new PathAbleError("unavailable", false)),
  hazards: () => Promise.reject(new PathAbleError("unavailable", false)),
  createReport: () => Promise.reject(new PathAbleError("unavailable", false)),
  withdrawReport: () => Promise.reject(new PathAbleError("unavailable", false)),
  analyzePhoto: () => Promise.resolve({ status: "unavailable", reason: "disabled" }),
};
