/**
 * The PathAble API contract. These Zod schemas are the source of truth:
 * - every response the web app receives is parsed with them, and a response
 *   that does not match is rejected, never rendered;
 * - `npm run contracts` generates contracts/openapi.json from them, and the
 *   FastAPI service is tested against that file and the shared fixtures.
 *
 * Human-readable text never crosses this boundary. Maneuvers, reasons, notes
 * and errors are codes that the client renders in the interface language.
 */
import { z } from "zod";

export const LonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type LonLat = z.infer<typeof LonLat>;

const IsoDate = z.iso.date();
const IsoDateTime = z.iso.datetime({ offset: true });

export const KnowledgeState = z.enum(["verified", "barrier", "unverified", "unknown"]);
export type KnowledgeState = z.infer<typeof KnowledgeState>;

export const DataSource = z.enum([
  "osm",
  "toronto-sidewalk-inventory",
  "toronto-sidewalk-polygons",
  "toronto-traffic-signals",
  "nrcan-hrdem-2023",
  "nrcan-hrdem-2015",
  "community-report",
]);
export type DataSource = z.infer<typeof DataSource>;

export const Attribute = z.enum(["presence", "surface", "width", "running_slope", "kerbs", "steps", "aps"]);
export type Attribute = z.infer<typeof Attribute>;

/** One measured or mapped fact about a segment, with where it came from. */
export const Evidence = z.object({
  attribute: Attribute,
  /** null means the attribute applies but nothing is known. */
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  unit: z.enum(["m", "pct"]).optional(),
  source: DataSource.nullable(),
  observedOn: IsoDate.nullable(),
  /** Measured error of the value, in `unit`. Values within it of a threshold are unknown. */
  error: z.number().nonnegative().optional(),
  /** An independent second measurement, e.g. the 2015 lidar slope. */
  corroboration: z
    .object({ value: z.number(), source: DataSource, observedOn: IsoDate })
    .optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Segment = z.object({
  id: z.string(),
  /** Inclusive index range into the route geometry. */
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  lengthM: z.number().nonnegative(),
  kind: z.enum(["sidewalk", "crossing", "path", "steps", "road_edge"]),
  streetName: z.string().nullable(),
  /** State for the preferences in the request. */
  state: KnowledgeState,
  evidence: z.array(Evidence),
});
export type Segment = z.infer<typeof Segment>;

export const HazardKind = z.enum([
  "obstacle",
  "surface_damage",
  "construction",
  "missing_ramp",
  "blocked_ramp",
  "snow",
  "ice",
  "steep_change",
]);
export type HazardKind = z.infer<typeof HazardKind>;

export const Hazard = z.object({
  id: z.string(),
  kind: HazardKind,
  status: z.enum(["verified", "reported"]),
  location: LonLat,
  source: DataSource,
  observedOn: IsoDate,
  expiresAt: IsoDateTime.nullable(),
  segmentId: z.string().nullable(),
});
export type Hazard = z.infer<typeof Hazard>;

export const Maneuver = z.enum([
  "depart",
  "continue",
  "turn_left",
  "turn_right",
  "slight_left",
  "slight_right",
  "cross",
  "arrive",
]);
export type Maneuver = z.infer<typeof Maneuver>;

export const StepNote = z.enum([
  "aps_present",
  "aps_absent",
  "kerbs_lowered",
  "kerbs_unknown",
  "kerb_raised",
  "slope_steep",
  "slope_unknown",
  "surface_unknown",
  "width_narrow",
  "steps",
  "hazard_reported",
]);
export type StepNote = z.infer<typeof StepNote>;

export const Step = z.object({
  maneuver: Maneuver,
  streetName: z.string().nullable(),
  distanceM: z.number().nonnegative(),
  segmentIds: z.array(z.string()),
  /** Index into the route geometry where the step begins. */
  at: z.number().int().nonnegative(),
  notes: z.array(StepNote),
});
export type Step = z.infer<typeof Step>;

export const ReasonCode = z.enum([
  "fewest_barriers",
  "most_verified",
  "shortest",
  "avoids_steps",
  "has_barriers",
  "steepest_section",
  "unknown_kerbs",
  "reported_hazards",
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

export const Reason = z.object({ code: ReasonCode, value: z.number().optional() });
export type Reason = z.infer<typeof Reason>;

export const Compatibility = z.enum(["compatible", "unknowns", "incompatible"]);
export type Compatibility = z.infer<typeof Compatibility>;

export const Route = z.object({
  id: z.string(),
  geometry: z.array(LonLat).min(2),
  distanceM: z.number().nonnegative(),
  durationS: z.number().nonnegative(),
  segments: z.array(Segment).min(1),
  hazards: z.array(Hazard),
  steps: z.array(Step).min(2),
  lengthByState: z.record(KnowledgeState, z.number().nonnegative()),
  barrierCount: z.number().int().nonnegative(),
  reportCount: z.number().int().nonnegative(),
  oldestObservation: IsoDate.nullable(),
  newestObservation: IsoDate.nullable(),
  compatibility: Compatibility,
  rank: z.number().int().positive(),
  score: z.number(),
  reasons: z.array(Reason),
});
export type Route = z.infer<typeof Route>;

export const Preferences = z.object({
  maxRunningSlopePct: z.number().min(1).max(15),
  minWidthM: z.number().min(0.6).max(3),
  avoidStairs: z.boolean(),
  avoidMissingRamps: z.boolean(),
  avoidDamagedSurfaces: z.boolean(),
  avoidReportedObstacles: z.boolean(),
  avoidNarrow: z.boolean(),
  preferVerified: z.boolean(),
  preferShorter: z.boolean(),
});
export type Preferences = z.infer<typeof Preferences>;

export const RouteRequest = z.object({
  origin: LonLat,
  destination: LonLat,
  preferences: Preferences,
});
export type RouteRequest = z.infer<typeof RouteRequest>;

export const ResponseSource = z.enum(["live", "development-fixture"]);
export type ResponseSource = z.infer<typeof ResponseSource>;

export const RouteResponse = z.object({
  source: ResponseSource,
  dataVersion: z.string(),
  generatedAt: IsoDateTime,
  routes: z.array(Route).min(1).max(3),
});
export type RouteResponse = z.infer<typeof RouteResponse>;

export const HazardsResponse = z.object({
  source: ResponseSource,
  generatedAt: IsoDateTime,
  hazards: z.array(Hazard),
});
export type HazardsResponse = z.infer<typeof HazardsResponse>;

export const ReportStatus = z.enum(["received", "under_review", "verified", "rejected", "withdrawn"]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ReportCreate = z.object({
  kind: HazardKind,
  location: LonLat,
  /** Free text the person chose to send; personal notes never leave the device. */
  description: z.string().max(500),
  photoId: z.string().nullable(),
  observedOn: IsoDate,
});
export type ReportCreate = z.infer<typeof ReportCreate>;

export const ReportReceipt = z.object({
  id: z.string(),
  status: ReportStatus,
  receivedAt: IsoDateTime,
});
export type ReportReceipt = z.infer<typeof ReportReceipt>;

export const Detection = z.object({
  kind: HazardKind,
  confidence: z.number().min(0).max(1),
  /** Normalised [x, y, width, height] in the photo, 0–1. */
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const AnalysisResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unavailable"), reason: z.enum(["no_model", "model_below_threshold", "disabled"]) }),
  z.object({ status: z.literal("ok"), modelVersion: z.string(), detections: z.array(Detection) }),
]);
export type AnalysisResponse = z.infer<typeof AnalysisResponse>;

export const ErrorCode = z.enum([
  "outside_coverage",
  "no_route",
  "invalid_request",
  "rate_limited",
  "unavailable",
  "not_found",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({ code: ErrorCode, retryable: z.boolean(), requestId: z.string().optional() }),
});
export type ApiError = z.infer<typeof ApiError>;
