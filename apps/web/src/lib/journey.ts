/**
 * A journey is what live guidance follows: one line on the map with the steps
 * along it. A walking route is a journey as it is; a transit option becomes
 * walk, board, ride, get off, walk, joined into one line so a single position
 * along it says where you are and what comes next.
 *
 * Everything here is plain data and maths, so it is unit-tested without a map.
 */
import type { KnowledgeState, LonLat, RideLeg, Route, Step, TransitOption } from "./api/contracts";

export type JourneyStep =
  | { kind: "walk"; step: Step; at: number; along: number }
  | { kind: "board"; ride: RideLeg; at: number; along: number }
  | { kind: "alight"; ride: RideLeg; at: number; along: number };

export interface JourneySegment {
  from: number;
  to: number;
  lengthM: number;
  state: KnowledgeState;
}

export interface Journey {
  id: string;
  geometry: LonLat[];
  /** Metres from the start to each point of the geometry. */
  cumulative: number[];
  totalM: number;
  steps: JourneyStep[];
  /** Walking stretches with their knowledge states (rides are drawn separately). */
  segments: JourneySegment[];
  /** Stretches spent on a vehicle, as distances along the journey. */
  rides: { startM: number; endM: number; leg: RideLeg }[];
  /** For transit: the scheduled arrival. Walking journeys work it out from speed. */
  scheduledArrival: string | null;
}

export const WALK_SPEED_MPS = 1.0; // the speed Toronto uses to time crossing signals

/** Distance in metres; flat-earth is exact enough over a few kilometres. */
export function metres(a: LonLat, b: LonLat): number {
  const k = Math.PI / 180;
  const x = (b[0] - a[0]) * k * Math.cos(((a[1] + b[1]) / 2) * k);
  const y = (b[1] - a[1]) * k;
  return Math.hypot(x, y) * 6_371_000;
}

/** Compass bearing from a to b, in degrees clockwise from north. */
export function bearing(a: LonLat, b: LonLat): number {
  const k = Math.PI / 180;
  const x = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * k);
  const y = b[1] - a[1];
  return ((Math.atan2(x, y) / k) % 360 + 360) % 360;
}

function cumulate(geometry: LonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < geometry.length; i++) out.push(out[i - 1] + metres(geometry[i - 1], geometry[i]));
  return out;
}

export function fromRoute(route: Route): Journey {
  const cumulative = cumulate(route.geometry);
  return {
    id: route.id,
    geometry: route.geometry,
    cumulative,
    totalM: cumulative[cumulative.length - 1],
    steps: route.steps.map((step) => ({ kind: "walk", step, at: step.at, along: cumulative[step.at] })),
    segments: route.segments.map(({ from, to, lengthM, state }) => ({ from, to, lengthM, state })),
    rides: [],
    scheduledArrival: null,
  };
}

const ARRIVE: Omit<Step, "at"> = { maneuver: "arrive", streetName: null, distanceM: 0, segmentIds: [], notes: [] };

export function fromTransit(option: TransitOption): Journey {
  const geometry: LonLat[] = [];
  const pending: { kind: JourneyStep["kind"]; at: number; step?: Step; ride?: RideLeg }[] = [];
  const segments: JourneySegment[] = [];
  const rideSpans: { from: number; to: number; leg: RideLeg }[] = [];
  option.legs.forEach((leg, i) => {
    const offset = geometry.length;
    const last = i === option.legs.length - 1;
    if (leg.kind === "walk") {
      geometry.push(...leg.route.geometry);
      for (const step of leg.route.steps) {
        // Only the final walk ends at the destination; earlier ones end at a stop.
        if (step.maneuver === "arrive" && !last) continue;
        pending.push({ kind: "walk", at: step.at + offset, step: { ...step, at: step.at + offset } });
      }
      for (const s of leg.route.segments) segments.push({ from: s.from + offset, to: s.to + offset, lengthM: s.lengthM, state: s.state });
    } else {
      geometry.push(...leg.geometry);
      pending.push({ kind: "board", at: offset, ride: leg });
      pending.push({ kind: "alight", at: geometry.length - 1, ride: leg });
      rideSpans.push({ from: offset, to: geometry.length - 1, leg });
      if (last) pending.push({ kind: "walk", at: geometry.length - 1, step: { ...ARRIVE, at: geometry.length - 1 } });
    }
  });
  const cumulative = cumulate(geometry);
  const steps = pending.map((p): JourneyStep => {
    const along = cumulative[p.at];
    if (p.kind === "walk") return { kind: "walk", step: p.step!, at: p.at, along };
    return { kind: p.kind, ride: p.ride!, at: p.at, along };
  });
  return {
    id: option.id,
    geometry,
    cumulative,
    totalM: cumulative[cumulative.length - 1],
    steps,
    segments,
    rides: rideSpans.map((r) => ({ startM: cumulative[r.from], endM: cumulative[r.to], leg: r.leg })),
    scheduledArrival: option.arriveAt,
  };
}

/** The point at `along` metres from the start, and the direction of travel there. */
export function pointAt(j: Journey, along: number): { position: LonLat; bearing: number } {
  const d = Math.min(Math.max(along, 0), j.totalM);
  let i = 1;
  while (i < j.cumulative.length - 1 && j.cumulative[i] < d) i++;
  const a = j.geometry[i - 1];
  const b = j.geometry[i];
  const span = j.cumulative[i] - j.cumulative[i - 1];
  const f = span > 0 ? (d - j.cumulative[i - 1]) / span : 0;
  return { position: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], bearing: bearing(a, b) };
}

export interface Fix {
  along: number;
  /** How far the reported position is from the line, in metres. */
  offRouteM: number;
  snapped: LonLat;
  bearing: number;
}

/**
 * Where a reported position is along the journey. Prefers not to jump
 * backwards, so a route that doubles back on itself does not send you to the
 * earlier pass.
 */
export function locate(j: Journey, p: LonLat, previousAlong = 0): Fix {
  const k = Math.PI / 180;
  const cos = Math.cos(p[1] * k);
  const toXY = (q: LonLat) => [(q[0] - p[0]) * k * cos * 6_371_000, (q[1] - p[1]) * k * 6_371_000];
  let best: Fix & { score: number } = { along: 0, offRouteM: Infinity, snapped: j.geometry[0], bearing: 0, score: Infinity };
  for (let i = 1; i < j.geometry.length; i++) {
    const [ax, ay] = toXY(j.geometry[i - 1]);
    const [bx, by] = toXY(j.geometry[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    const along = j.cumulative[i - 1] + t * (j.cumulative[i] - j.cumulative[i - 1]);
    const back = previousAlong - along;
    const score = off + (back > 25 ? back : 0);
    if (score < best.score) {
      const a = j.geometry[i - 1];
      const b = j.geometry[i];
      best = { along, offRouteM: off, snapped: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearing(a, b), score };
    }
  }
  return { along: best.along, offRouteM: best.offRouteM, snapped: best.snapped, bearing: best.bearing };
}

export interface Progress {
  /** The next thing to do, or the arrival. */
  next: JourneyStep;
  nextIndex: number;
  /** Metres until that step. */
  toNextM: number;
  remainingM: number;
  /** Seconds still to go: walking at WALK_SPEED_MPS, riding at the vehicle's scheduled pace. */
  remainingS: number;
  ride: Journey["rides"][number] | null;
  arrived: boolean;
}

const ARRIVED_WITHIN_M = 15;
const STEP_PASSED_M = 4;

export function progress(j: Journey, along: number): Progress {
  const remainingM = Math.max(0, j.totalM - along);
  const ride = j.rides.find((r) => along >= r.startM - 1 && along < r.endM - 1) ?? null;
  let nextIndex = j.steps.findIndex((s) => s.along > along + STEP_PASSED_M);
  if (nextIndex === -1) nextIndex = j.steps.length - 1;
  // On board, the next instruction is always where to get off.
  if (ride) nextIndex = j.steps.findIndex((s) => s.kind === "alight" && s.ride === ride.leg);
  const next = j.steps[nextIndex];
  let remainingS = 0;
  let cursor = along;
  for (const r of j.rides) {
    if (r.endM <= cursor) continue;
    const start = Math.max(cursor, r.startM);
    remainingS += Math.max(0, r.startM - cursor) / WALK_SPEED_MPS;
    const rideS = (Date.parse(r.leg.arriveAt) - Date.parse(r.leg.departAt)) / 1000;
    remainingS += rideS * ((r.endM - start) / Math.max(1, r.endM - r.startM));
    cursor = r.endM;
  }
  remainingS += Math.max(0, j.totalM - cursor) / WALK_SPEED_MPS;
  return {
    next,
    nextIndex,
    toNextM: Math.max(0, next.along - along),
    remainingM,
    remainingS: Math.round(remainingS),
    ride,
    arrived: remainingM <= ARRIVED_WITHIN_M && !ride,
  };
}

/** Off the route: far from the line on several fixes in a row, never while riding. */
export const OFF_ROUTE_M = 35;
export const OFF_ROUTE_FIXES = 3;
