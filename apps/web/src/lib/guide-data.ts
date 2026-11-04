import "server-only";
import sample from "@/generated/fixtures/routes/york-u-finch-west.json";
import transitSample from "@/generated/fixtures/transit/york-u-finch-west.json";
import type { LonLat, Maneuver, Step, StepNote } from "./api/contracts";
import { RouteResponse, TransitResponse } from "./api/contracts";

/**
 * The landing's scroll-through guidance, precomputed at build time from a real
 * fixture route (York University to Finch West): the line drawn in SVG units,
 * the quieter alternatives behind it, where along the line each real step
 * begins, and the handful of steps the story stops at. Nothing here is
 * invented; it is the planner's own output.
 */
export interface GuideData {
  width: number;
  height: number;
  route: string;
  alternatives: string[];
  origin: [number, number];
  destination: [number, number];
  steps: { at: number; maneuver: Maneuver; streetName: string | null; notes: StepNote[] }[];
  /** Index into steps for each chapter of the story, in order. */
  chapters: { id: ChapterId; step: number }[];
  durationS: number;
  distanceM: number;
  /** Minutes the fastest step-free transit option saves over walking, if it saves any. */
  transit: { line: string; mode: string; savesMin: number } | null;
}

export type ChapterId = "instruction" | "unknown" | "signal" | "transit" | "arrive";

const W = 360;
const H = 560;
const PAD = 48;

function metres(a: LonLat, b: LonLat) {
  const k = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(a[1] * k), b[1] - a[1]) * 111_320;
}

/**
 * Pick the steps the story pauses on: a crossing with recorded curb ramps, a
 * signalled crossing where the City's record is blank, one with an accessible signal, the next
 * turn after it (where the transit option is shown), and the arrival. Each is
 * searched for after the one before, so the story always moves forward.
 */
function pickChapters(steps: GuideData["steps"]): GuideData["chapters"] {
  const wants: [ChapterId, (s: GuideData["steps"][number]) => boolean][] = [
    ["instruction", (s) => s.notes.includes("kerbs_lowered")],
    ["unknown", (s) => s.maneuver === "cross" && s.notes.includes("aps_unknown")],
    ["signal", (s) => s.notes.includes("aps_present")],
    ["transit", (s) => s.maneuver === "turn_left" || s.maneuver === "turn_right"],
  ];
  const out: GuideData["chapters"] = [];
  let from = 1;
  for (const [id, test] of wants) {
    const i = steps.findIndex((s, j) => j >= from && test(s));
    if (i === -1) continue;
    out.push({ id, step: i });
    from = i + 1;
  }
  out.push({ id: "arrive", step: steps.length - 1 });
  return out;
}

export function guideData(): GuideData {
  const routes = RouteResponse.parse(sample.response).routes;
  const best = routes.find((r) => r.rank === 1) ?? routes[0];
  const all = routes.flatMap((r) => r.geometry);
  const k = Math.cos((43.77 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD - 120) / (maxY - minY));
  const ox = (W - (maxX - minX) * scale) / 2;
  // Leave room for the instruction banner at the top of the phone.
  const oy = 110 + (H - 110 - 70 - (maxY - minY) * scale) / 2;
  const project = ([lon, lat]: LonLat): [number, number] => [
    Math.round((ox + (lon * k - minX) * scale) * 10) / 10,
    Math.round((oy + (maxY - lat) * scale) * 10) / 10,
  ];
  const path = (pts: LonLat[]) => pts.map((p, i) => `${i ? "L" : "M"}${project(p).join(" ")}`).join("");

  const cumulative = [0];
  for (let i = 1; i < best.geometry.length; i++) cumulative.push(cumulative[i - 1] + metres(best.geometry[i - 1], best.geometry[i]));
  const total = cumulative.at(-1)!;
  const steps = best.steps.map((s: Step) => ({ at: cumulative[s.at] / total, maneuver: s.maneuver, streetName: s.streetName, notes: s.notes }));

  // The same comparison the planner makes: the fastest step-free option against walking.
  const options = TransitResponse.parse(transitSample.response).options.filter((o) => o.stepFree === "yes");
  const fastest = options.sort((a, b) => a.durationS - b.durationS)[0];
  const ride = fastest?.legs.find((l) => l.kind === "ride");
  const savesMin = fastest ? Math.round((best.durationS - fastest.durationS) / 60) : 0;
  const transit = ride && ride.kind === "ride" && savesMin > 0 ? { line: ride.line, mode: ride.mode, savesMin } : null;

  return {
    width: W,
    height: H,
    route: path(best.geometry),
    alternatives: routes.filter((r) => r !== best).map((r) => path(r.geometry)),
    origin: project(best.geometry[0]),
    destination: project(best.geometry.at(-1)!),
    steps,
    // Without a quicker step-free option there is nothing to say about transit, so that chapter goes.
    chapters: pickChapters(steps).filter((c) => c.id !== "transit" || transit),
    durationS: best.durationS,
    distanceM: best.distanceM,
    transit,
  };
}
