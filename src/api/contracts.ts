/**
 * PathAble API contract (v1).
 *
 * This file is the single source of truth for the shape of data exchanged with
 * the PathAble backend. Every response is parsed with these schemas at runtime,
 * so a backend change that breaks the contract fails loudly in one place instead
 * of rendering wrong accessibility information.
 *
 * Human-readable text (directions, explanations) is intentionally NOT part of
 * the contract: the API returns codes and the client renders them in the
 * user's language. See docs/API_CONTRACT.md.
 */
import { z } from "zod";

/* ----------------------------------------------------------------------------
 * Primitives
 * ------------------------------------------------------------------------- */

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const IsoDateSchema = z.iso.datetime({ offset: true });

/** Where a piece of data came from. Shown to users next to every fact. */
export const DataSourceSchema = z.enum([
  "municipal_open_data",
  "field_survey",
  "community_report",
  "community_verified",
  "model_assisted",
  "openstreetmap",
  "development_fixture",
]);
export type DataSource = z.infer<typeof DataSourceSchema>;

/** Response-level provenance. `development-fixture` must never be presented as live. */
export const ResponseSourceSchema = z.enum(["live", "development-fixture"]);
export type ResponseSource = z.infer<typeof ResponseSourceSchema>;

/* ----------------------------------------------------------------------------
 * Mobility profile
 * ------------------------------------------------------------------------- */

export const MOBILITY_PROFILE_IDS = [
  "manual_wheelchair",
  "powered_wheelchair",
  "mobility_scooter",
  "walker",
  "cane",
  "reduced_mobility",
  "stroller",
  "custom",
] as const;
export const MobilityProfileIdSchema = z.enum(MOBILITY_PROFILE_IDS);
export type MobilityProfileId = z.infer<typeof MobilityProfileIdSchema>;

export const PREFERENCE_FLAGS = [
  "avoidStairs",
  "avoidSteepCurbs",
  "avoidDamagedSurfaces",
  "avoidReportedObstacles",
  "avoidNarrowPassages",
  "preferVerifiedRoutes",
  "preferShorterRoutes",
] as const;
export type PreferenceFlag = (typeof PREFERENCE_FLAGS)[number];

export const MobilityPreferencesSchema = z.object({
  profile: MobilityProfileIdSchema,
  /** Maximum running slope the person is comfortable with, in percent. null = no limit. */
  maxSlopePercent: z.number().min(1).max(20).nullable(),
  /** Minimum clear path width in centimetres. null = no requirement. */
  minWidthCm: z.number().min(50).max(250).nullable(),
  avoidStairs: z.boolean(),
  avoidSteepCurbs: z.boolean(),
  avoidDamagedSurfaces: z.boolean(),
  avoidReportedObstacles: z.boolean(),
  avoidNarrowPassages: z.boolean(),
  preferVerifiedRoutes: z.boolean(),
  preferShorterRoutes: z.boolean(),
});
export type MobilityPreferences = z.infer<typeof MobilityPreferencesSchema>;

/* ----------------------------------------------------------------------------
 * Hazards
 * ------------------------------------------------------------------------- */

export const HAZARD_TYPES = [
  "stairs",
  "missing_curb_ramp",
  "blocked_curb_ramp",
  "steep_slope",
  "damaged_surface",
  "narrow_passage",
  "construction",
  "obstruction",
  "snow_blocked",
  "ice",
  "flooding",
  "other",
] as const;
export const HazardTypeSchema = z.enum(HAZARD_TYPES);
export type HazardType = z.infer<typeof HazardTypeSchema>;

export const WINTER_HAZARDS: readonly HazardType[] = ["snow_blocked", "ice"];

export const HazardSchema = z.object({
  id: z.string(),
  type: HazardTypeSchema,
  location: LatLngSchema,
  /** verified: confirmed by a trusted source. reported: one or more community reports, not yet confirmed. */
  status: z.enum(["verified", "reported", "resolved"]),
  severity: z.enum(["blocking", "caution"]),
  source: DataSourceSchema,
  reportedAt: IsoDateSchema,
  verifiedAt: IsoDateSchema.nullable(),
  /** For seasonal / temporary conditions. Clients hide hazards after this time. */
  expiresAt: IsoDateSchema.nullable(),
  confirmations: z.number().int().nonnegative(),
  description: z.string().max(500).nullable(),
});
export type Hazard = z.infer<typeof HazardSchema>;

export const HazardsResponseSchema = z.object({
  source: ResponseSourceSchema,
  generatedAt: IsoDateSchema,
  hazards: z.array(HazardSchema),
});
export type HazardsResponse = z.infer<typeof HazardsResponseSchema>;

/* ----------------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------------- */

/**
 * What we know about a stretch of sidewalk. The four states are deliberately
 * distinct and are always shown with a pattern + label, never colour alone.
 */
export const SegmentStatusSchema = z.enum([
  "verified_accessible", // known information says it meets the profile
  "known_barrier", // a verified barrier exists
  "reported_unverified", // community report(s) not yet confirmed
  "unknown", // no data — NOT the same as accessible
]);
export type SegmentStatus = z.infer<typeof SegmentStatusSchema>;

export const RouteSegmentSchema = z.object({
  id: z.string(),
  /** Inclusive indexes into the route geometry coordinates. */
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
  status: SegmentStatusSchema,
  lengthMeters: z.number().nonnegative(),
  maxSlopePercent: z.number().nullable(),
  minWidthCm: z.number().nullable(),
  surface: z.enum(["smooth", "uneven", "damaged", "unknown"]),
  source: DataSourceSchema,
  observedAt: IsoDateSchema.nullable(),
  hazardIds: z.array(z.string()),
});
export type RouteSegment = z.infer<typeof RouteSegmentSchema>;

export const MANEUVER_TYPES = [
  "depart",
  "continue",
  "turn",
  "cross",
  "use_curb_ramp",
  "use_ramp",
  "use_elevator",
  "arrive",
] as const;

export const RouteStepSchema = z.object({
  maneuver: z.object({
    type: z.enum(MANEUVER_TYPES),
    modifier: z.enum(["left", "right", "slight_left", "slight_right", "straight"]).nullable(),
  }),
  /** Street or path name from the map data; null when unnamed. Not translated. */
  streetName: z.string().nullable(),
  distanceMeters: z.number().nonnegative(),
  location: LatLngSchema,
  /** Accessibility note codes rendered by the client, e.g. "signalized_crossing". */
  notes: z.array(z.enum(["signalized_crossing", "accessible_pedestrian_signal", "curb_ramp_both_sides", "unverified_section", "known_barrier_ahead", "steep_section"])),
});
export type RouteStep = z.infer<typeof RouteStepSchema>;

export const RECOMMENDATION_REASONS = [
  "fewest_known_barriers",
  "highest_verified_coverage",
  "avoids_stairs",
  "within_slope_preference",
  "fewest_unverified_reports",
  "shortest_distance",
  "most_recent_data",
] as const;
export const RecommendationReasonSchema = z.enum(RECOMMENDATION_REASONS);
export type RecommendationReason = z.infer<typeof RecommendationReasonSchema>;

export const PreferenceConflictSchema = z.object({
  preference: z.enum([...PREFERENCE_FLAGS, "maxSlopePercent", "minWidthCm"]),
  segmentIds: z.array(z.string()),
});
export type PreferenceConflict = z.infer<typeof PreferenceConflictSchema>;

export const RouteSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  geometry: z.object({
    type: z.literal("LineString"),
    /** [lng, lat] pairs (GeoJSON order). */
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
  }),
  summary: z.object({
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
    /** Share of route length per status, 0..1. Always sums to ~1. */
    coverage: z.object({
      verified_accessible: z.number().min(0).max(1),
      known_barrier: z.number().min(0).max(1),
      reported_unverified: z.number().min(0).max(1),
      unknown: z.number().min(0).max(1),
    }),
    knownBarrierCount: z.number().int().nonnegative(),
    unverifiedReportCount: z.number().int().nonnegative(),
    oldestObservationAt: IsoDateSchema.nullable(),
    newestObservationAt: IsoDateSchema.nullable(),
  }),
  compatibility: z.object({
    /** meets: no known conflicts (unknown sections may still exist). */
    level: z.enum(["meets", "partial", "conflicts", "insufficient_data"]),
    conflicts: z.array(PreferenceConflictSchema),
  }),
  recommendation: z.object({
    rank: z.number().int().positive(),
    reasons: z.array(RecommendationReasonSchema),
  }),
  segments: z.array(RouteSegmentSchema),
  hazards: z.array(HazardSchema),
  steps: z.array(RouteStepSchema),
});
export type Route = z.infer<typeof RouteSchema>;

export const RouteRequestSchema = z.object({
  origin: LatLngSchema,
  destination: LatLngSchema,
  preferences: MobilityPreferencesSchema,
  /** Used only for hazard/season context; text is localized client-side. */
  departAt: IsoDateSchema.nullable(),
  alternatives: z.number().int().min(1).max(5),
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const RoutesResponseSchema = z.object({
  requestId: z.string(),
  source: ResponseSourceSchema,
  generatedAt: IsoDateSchema,
  coverage: z.object({
    /** Whether origin and destination are inside an area with accessibility data. */
    status: z.enum(["covered", "partial", "outside"]),
    region: z.string().nullable(),
  }),
  routes: z.array(RouteSchema),
});
export type RoutesResponse = z.infer<typeof RoutesResponseSchema>;

/* ----------------------------------------------------------------------------
 * Photo analysis & reports
 * ------------------------------------------------------------------------- */

export const DetectionSchema = z.object({
  id: z.string(),
  label: HazardTypeSchema,
  confidence: z.number().min(0).max(1),
  /** Normalised 0..1 box relative to the uploaded image. */
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
});
export type Detection = z.infer<typeof DetectionSchema>;

export const AnalysisResponseSchema = z.object({
  analysisId: z.string(),
  model: z.object({ name: z.string(), version: z.string() }),
  processedAt: IsoDateSchema,
  detections: z.array(DetectionSchema),
  /** Server-side guidance, e.g. "image_too_dark". Codes are localized client-side. */
  qualityIssues: z.array(z.enum(["image_too_dark", "image_blurry", "no_sidewalk_visible", "faces_blurred"])),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export const ReportSubmissionSchema = z.object({
  hazardType: HazardTypeSchema,
  location: LatLngSchema,
  locationLabel: z.string().max(200).nullable(),
  severity: z.enum(["blocking", "caution"]),
  description: z.string().max(500),
  observedAt: IsoDateSchema,
  /** Present when the user ran photo analysis. */
  analysis: z
    .object({
      analysisId: z.string(),
      acceptedDetectionIds: z.array(z.string()),
      rejectedDetectionIds: z.array(z.string()),
      /** True when the user changed the hazard type away from the model's top prediction. */
      correctedByUser: z.boolean(),
    })
    .nullable(),
  /** Seasonal reports expire automatically. */
  temporary: z.boolean(),
});
export type ReportSubmission = z.infer<typeof ReportSubmissionSchema>;

export const ReportReceiptSchema = z.object({
  id: z.string(),
  status: z.enum(["received", "under_review", "verified", "rejected", "withdrawn"]),
  createdAt: IsoDateSchema,
});
export type ReportReceipt = z.infer<typeof ReportReceiptSchema>;

/* ----------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum([
      "invalid_request",
      "outside_coverage",
      "no_route_found",
      "rate_limited",
      "unavailable",
      "image_rejected",
      "internal",
    ]),
    message: z.string(),
    retryAfterSeconds: z.number().nullable().optional(),
  }),
});
export type ApiErrorCode = z.infer<typeof ApiErrorBodySchema>["error"]["code"];
