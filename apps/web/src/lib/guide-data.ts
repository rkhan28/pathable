import "server-only";
import sample from "@/generated/fixtures/routes/york-u-finch-west.json";
import type { LonLat, Maneuver, Step } from "./api/contracts";
import { RouteResponse } from "./api/contracts";

/**
 * The landing's guidance illustration, precomputed at build time from a real
 * fixture route (York University to Finch West): the line drawn in SVG units,
 * the quieter alternatives behind it, and where along the line each real
 * step begins. Nothing here is invented; it is the planner's own output.
 */
export interface GuideData {
  width: number;
  height: number;
  route: string;
  alternatives: string[];
  origin: [number, number];
  destination: [number, number];
  steps: { at: number; maneuver: Maneuver; streetName: string | null }[];
  durationS: number;
  distanceM: number;
}

const W = 360;
const H = 560;
const PAD = 48;

function metres(a: LonLat, b: LonLat) {
  const k = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(a[1] * k), b[1] - a[1]) * 111_320;
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
  const steps = best.steps.map((s: Step) => ({ at: cumulative[s.at] / total, maneuver: s.maneuver, streetName: s.streetName }));

  return {
    width: W,
    height: H,
    route: path(best.geometry),
    alternatives: routes.filter((r) => r !== best).map((r) => path(r.geometry)),
    origin: project(best.geometry[0]),
    destination: project(best.geometry.at(-1)!),
    steps,
    durationS: best.durationS,
    distanceM: best.distanceM,
  };
}
