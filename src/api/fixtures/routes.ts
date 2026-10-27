/**
 * DEVELOPMENT FIXTURES — NOT REAL NAVIGATION DATA.
 *
 * Generates deterministic sample routes so the interface can be built and
 * tested before the routing backend exists. Everything produced here:
 * - is marked `source: "development-fixture"` at the response level,
 * - uses `development_fixture` as the data source of every segment and hazard,
 * - uses synthetic geometry aligned to Toronto's street-grid angle, which can
 *   pass through buildings and does NOT follow real sidewalks,
 * - never includes street names (inventing them would look like real directions).
 *
 * The UI shows a persistent "Sample data" notice whenever this source is active.
 */
import type {
  Hazard,
  HazardType,
  LatLng,
  RouteRequest,
  RouteSegment,
  RoutesResponse,
  RouteStep,
} from "../contracts";
import { ApiError } from "../errors";
import { coverageOf, rankRoutes, type RouteDraft } from "@/features/routing/scoring";
import { GTA_BBOX, haversineMeters, isInsideBbox, lineLengthMeters, type Coord } from "@/lib/geo";
import { hashString, seededRandom } from "@/lib/utils";

/** Downtown Toronto's grid is rotated ≈16.5° west of true north. */
const GRID_ANGLE = (16.5 * Math.PI) / 180;
const METERS_PER_DEG_LAT = 110_540;
const SPACING_M = 20;
const MAX_STRAIGHT_LINE_M = 12_000;

type XY = [number, number];

interface Frame {
  toGrid(p: LatLng): XY;
  toLatLng(p: XY): Coord;
}

function makeFrame(origin: LatLng): Frame {
  const mPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const e: XY = [Math.cos(GRID_ANGLE), Math.sin(GRID_ANGLE)];
  const n: XY = [-Math.sin(GRID_ANGLE), Math.cos(GRID_ANGLE)];
  return {
    toGrid({ lat, lng }) {
      const x = (lng - origin.lng) * mPerDegLng;
      const y = (lat - origin.lat) * METERS_PER_DEG_LAT;
      return [x * e[0] + y * e[1], x * n[0] + y * n[1]];
    },
    toLatLng([gx, gy]) {
      const x = gx * e[0] + gy * n[0];
      const y = gx * e[1] + gy * n[1];
      return [origin.lng + x / mPerDegLng, origin.lat + y / METERS_PER_DEG_LAT];
    },
  };
}

/** Corner polylines in grid space for three structurally different alternatives. */
function candidatePaths([dx, dy]: XY): XY[][] {
  const jog = 110;
  const sx = Math.sign(dx) || 1;
  const sy = Math.sign(dy) || 1;
  if (Math.abs(dx) < 60) {
    return [
      [[0, 0], [jog, 0], [jog, dy], [dx, dy]],
      [[0, 0], [0, dy]],
      [[0, 0], [-jog, 0], [-jog, dy], [dx, dy]],
    ];
  }
  if (Math.abs(dy) < 60) {
    return [
      [[0, 0], [0, jog], [dx, jog], [dx, dy]],
      [[0, 0], [dx, 0]],
      [[0, 0], [0, -jog], [dx, -jog], [dx, dy]],
    ];
  }
  return [
    [[0, 0], [dx, 0], [dx, dy]],
    [[0, 0], [0, dy], [dx, dy]],
    [[0, 0], [dx * 0.5, 0], [dx * 0.5, dy + jog * sy], [dx + jog * 0.4 * sx, dy + jog * sy], [dx, dy]],
  ];
}

function densify(corners: XY[]): { points: XY[]; cornerIndexes: number[] } {
  const points: XY[] = [corners[0]];
  const cornerIndexes = [0];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1];
    const [bx, by] = corners[i];
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.round(len / SPACING_M));
    for (let s = 1; s <= steps; s++) points.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
    cornerIndexes.push(points.length - 1);
  }
  return { points, cornerIndexes };
}

type Personality = {
  verifiedShare: number;
  barrier: HazardType | null;
  reports: number;
  steepSegment: boolean;
};

const PERSONALITIES: Personality[] = [
  { verifiedShare: 0.62, barrier: "missing_curb_ramp", reports: 1, steepSegment: false },
  { verifiedShare: 0.45, barrier: "stairs", reports: 1, steepSegment: true },
  { verifiedShare: 0.82, barrier: null, reports: 1, steepSegment: false },
];

const isWinter = (d: Date) => [10, 11, 0, 1, 2, 3].includes(d.getMonth());
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function buildRoute(
  id: string,
  coords: Coord[],
  cornerIndexes: number[],
  personality: Personality,
  rand: () => number,
  now: Date,
): RouteDraft {
  const segments: RouteSegment[] = [];
  const hazards: Hazard[] = [];
  let start = 0;
  let segIndex = 0;
  while (start < coords.length - 1) {
    const end = Math.min(coords.length - 1, start + 5 + Math.floor(rand() * 5));
    segments.push({
      id: `${id}-s${segIndex++}`,
      startIndex: start,
      endIndex: end,
      status: rand() < personality.verifiedShare ? "verified_accessible" : "unknown",
      lengthMeters: Math.round(lineLengthMeters(coords, start, end)),
      maxSlopePercent: null,
      minWidthCm: null,
      surface: "unknown",
      source: "development_fixture",
      observedAt: null,
      hazardIds: [],
    });
    start = end;
  }

  // Fill in attributes for verified segments.
  for (const s of segments) {
    if (s.status === "verified_accessible") {
      s.maxSlopePercent = Math.round((1 + rand() * 3) * 10) / 10;
      s.minWidthCm = 150 + Math.round(rand() * 6) * 10;
      s.surface = "smooth";
      s.observedAt = daysAgo(now, 20 + Math.floor(rand() * 260));
    }
  }

  const pickInterior = () => segments[Math.min(segments.length - 1, 1 + Math.floor(rand() * Math.max(1, segments.length - 2)))];
  const midpoint = (s: RouteSegment): LatLng => {
    const [lng, lat] = coords[Math.floor((s.startIndex + s.endIndex) / 2)];
    return { lat, lng };
  };

  if (personality.barrier && segments.length > 2) {
    const s = pickInterior();
    s.status = "known_barrier";
    s.observedAt = daysAgo(now, 30 + Math.floor(rand() * 90));
    const hazard: Hazard = {
      id: `${s.id}-h`,
      type: personality.barrier,
      location: midpoint(s),
      status: "verified",
      severity: "blocking",
      source: "development_fixture",
      reportedAt: daysAgo(now, 120),
      verifiedAt: s.observedAt,
      expiresAt: null,
      confirmations: 3,
      description: null,
    };
    s.hazardIds.push(hazard.id);
    hazards.push(hazard);
  }

  if (personality.steepSegment) {
    const s = segments.find((x) => x.status === "verified_accessible" && x.hazardIds.length === 0);
    if (s) {
      s.maxSlopePercent = 7.5;
      const hazard: Hazard = {
        id: `${s.id}-slope`,
        type: "steep_slope",
        location: midpoint(s),
        status: "verified",
        severity: "caution",
        source: "development_fixture",
        reportedAt: daysAgo(now, 200),
        verifiedAt: daysAgo(now, 160),
        expiresAt: null,
        confirmations: 2,
        description: null,
      };
      s.hazardIds.push(hazard.id);
      hazards.push(hazard);
    }
  }

  const winter = isWinter(now);
  for (let r = 0; r < personality.reports && segments.length > 1; r++) {
    const candidates = segments.filter((x) => x.hazardIds.length === 0);
    const s = candidates[Math.floor(rand() * candidates.length)];
    if (!s) break;
    s.status = "reported_unverified";
    const reportedAt = daysAgo(now, 1 + Math.floor(rand() * 5));
    s.observedAt = reportedAt;
    const type: HazardType = winter ? (rand() < 0.5 ? "snow_blocked" : "ice") : rand() < 0.5 ? "damaged_surface" : "obstruction";
    const hazard: Hazard = {
      id: `${s.id}-r`,
      type,
      location: midpoint(s),
      status: "reported",
      severity: "caution",
      source: "development_fixture",
      reportedAt,
      verifiedAt: null,
      expiresAt: winter ? new Date(now.getTime() + 2 * 86_400_000).toISOString() : null,
      confirmations: 1 + Math.floor(rand() * 2),
      description: null,
    };
    if (type === "damaged_surface") s.surface = "damaged";
    s.hazardIds.push(hazard.id);
    hazards.push(hazard);
  }

  const steps = buildSteps(coords, cornerIndexes, segments);
  const distanceMeters = Math.round(lineLengthMeters(coords));
  const observed = segments.map((s) => s.observedAt).filter((d): d is string => d !== null).sort();

  return {
    id,
    label: null,
    geometry: { type: "LineString", coordinates: coords },
    summary: {
      distanceMeters,
      durationSeconds: Math.round(distanceMeters / 1.0),
      coverage: coverageOf(segments),
      knownBarrierCount: segments.filter((s) => s.status === "known_barrier").length,
      unverifiedReportCount: hazards.filter((h) => h.status === "reported").length,
      oldestObservationAt: observed[0] ?? null,
      newestObservationAt: observed[observed.length - 1] ?? null,
    },
    segments,
    hazards,
    steps,
  };
}

function buildSteps(coords: Coord[], corners: number[], segments: RouteSegment[]): RouteStep[] {
  const steps: RouteStep[] = [];
  const at = (i: number): LatLng => ({ lng: coords[i][0], lat: coords[i][1] });
  const notesFor = (from: number, to: number): RouteStep["notes"] => {
    const overlapping = segments.filter((s) => s.endIndex > from && s.startIndex < to);
    const notes: RouteStep["notes"] = [];
    if (overlapping.some((s) => s.status === "known_barrier")) notes.push("known_barrier_ahead");
    if (overlapping.some((s) => s.status === "unknown" || s.status === "reported_unverified")) notes.push("unverified_section");
    if (overlapping.some((s) => (s.maxSlopePercent ?? 0) > 6)) notes.push("steep_section");
    return notes;
  };

  for (let c = 0; c < corners.length - 1; c++) {
    const from = corners[c];
    const to = corners[c + 1];
    const distance = Math.round(lineLengthMeters(coords, from, to));
    if (c === 0) {
      steps.push({ maneuver: { type: "depart", modifier: null }, streetName: null, distanceMeters: distance, location: at(from), notes: notesFor(from, to) });
      continue;
    }
    const prev = coords[corners[c - 1]];
    const here = coords[from];
    const next = coords[to];
    const cross = (here[0] - prev[0]) * (next[1] - here[1]) - (here[1] - prev[1]) * (next[0] - here[0]);
    steps.push({
      maneuver: { type: "turn", modifier: cross > 0 ? "left" : "right" },
      streetName: null,
      distanceMeters: distance,
      location: at(from),
      notes: ["curb_ramp_both_sides", ...notesFor(from, to)].filter((n, i, a) => a.indexOf(n) === i) as RouteStep["notes"],
    });
  }
  steps.push({ maneuver: { type: "arrive", modifier: null }, streetName: null, distanceMeters: 0, location: at(coords.length - 1), notes: [] });
  return steps;
}

export function generateFixtureRoutes(request: RouteRequest, now: Date = new Date()): RoutesResponse {
  const { origin, destination, preferences } = request;
  if (!isInsideBbox(origin, GTA_BBOX) || !isInsideBbox(destination, GTA_BBOX)) {
    throw new ApiError("outside_coverage", "Sample routes are only generated inside the Greater Toronto Area.");
  }
  const straight = haversineMeters(origin, destination);
  if (straight < 30) throw new ApiError("invalid_request", "Start and destination are the same place.");
  if (straight > MAX_STRAIGHT_LINE_M) throw new ApiError("no_route_found", "Sample routes are limited to 12 km.");

  const seed = hashString(`${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}>${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`);
  const rand = seededRandom(seed);
  const frame = makeFrame(origin);
  const target = frame.toGrid(destination);

  // Rotate personalities by seed so the recommended route isn't always the same shape.
  const offset = seed % PERSONALITIES.length;
  const drafts = candidatePaths(target)
    .slice(0, request.alternatives)
    .map((corners, i) => {
      const { points, cornerIndexes } = densify(corners);
      const coords = points.map((p) => frame.toLatLng(p));
      coords[0] = [origin.lng, origin.lat];
      coords[coords.length - 1] = [destination.lng, destination.lat];
      return buildRoute(`fx-${seed.toString(36)}-${i}`, coords, cornerIndexes, PERSONALITIES[(i + offset) % PERSONALITIES.length], rand, now);
    });

  return {
    requestId: `fx-req-${seed.toString(36)}`,
    source: "development-fixture",
    generatedAt: now.toISOString(),
    coverage: { status: "partial", region: "Toronto (sample data)" },
    routes: rankRoutes(drafts, preferences),
  };
}

/** Stable sample hazards for the map's "nearby" layer, seeded per 0.01° cell. */
export function generateFixtureHazards([w, s, e, n]: [number, number, number, number], now: Date = new Date()): Hazard[] {
  if (e - w > 0.25 || n - s > 0.2) return [];
  const hazards: Hazard[] = [];
  const winter = isWinter(now);
  const types: HazardType[] = winter
    ? ["snow_blocked", "ice", "blocked_curb_ramp", "construction", "missing_curb_ramp"]
    : ["construction", "damaged_surface", "missing_curb_ramp", "obstruction", "narrow_passage"];
  for (let lat = Math.floor(s * 100) / 100; lat < n; lat += 0.01) {
    for (let lng = Math.floor(w * 100) / 100; lng < e; lng += 0.01) {
      const cell = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      const rand = seededRandom(hashString(cell));
      if (rand() > 0.35) continue;
      const point = { lat: lat + rand() * 0.01, lng: lng + rand() * 0.01 };
      if (!isInsideBbox(point, GTA_BBOX)) continue;
      const verified = rand() < 0.4;
      const type = types[Math.floor(rand() * types.length)];
      const reportedAt = daysAgo(now, verified ? 10 + Math.floor(rand() * 60) : 1 + Math.floor(rand() * 4));
      hazards.push({
        id: `fxh-${cell}`,
        type,
        location: point,
        status: verified ? "verified" : "reported",
        severity: type === "construction" || type === "snow_blocked" || type === "blocked_curb_ramp" ? "blocking" : "caution",
        source: "development_fixture",
        reportedAt,
        verifiedAt: verified ? daysAgo(now, 5) : null,
        expiresAt: type === "snow_blocked" || type === "ice" ? new Date(now.getTime() + 36 * 3_600_000).toISOString() : null,
        confirmations: verified ? 3 : 1,
        description: null,
      });
    }
  }
  return hazards.slice(0, 80);
}
