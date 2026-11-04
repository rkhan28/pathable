import "server-only";
import graph from "@/generated/fixtures/graph-york-u-finch-west.json";
import routesSample from "@/generated/fixtures/routes/york-u-finch-west.json";
import transitSample from "@/generated/fixtures/transit/york-u-finch-west.json";
import type { Evidence, Hazard, KnowledgeState, LonLat } from "./api/contracts";
import { RouteResponse, TransitResponse } from "./api/contracts";
import { segmentState } from "./scoring";
import { routeLabel } from "./route-label";
import { DEFAULT_PREFERENCES } from "@/stores/preferences";

/**
 * The landing hero's moving picture, built once at build time from the real
 * corridor graph: every sidewalk, path and crossing between York University
 * and Finch West, coloured by what is known about it under the default
 * limits (5% slope, 1.5 m width), plus the planner's own routes for that trip.
 *
 * Coordinates are projected to a plane `w` wide and rounded to whole units
 * (about 2 m each), then sent as flat number arrays to keep the file small.
 */
export interface NetworkData {
  w: number;
  h: number;
  /** One entry per edge: knowledge state code, then x0, y0, x1, y1, ... */
  edges: [StateCode, ...number[]][];
  shows: NetworkShow[];
  origin: [number, number];
  destination: [number, number];
}

export type StateCode = "v" | "b" | "r" | "u";

/** One route the hero draws in turn. Walk legs are drawn in the route colour, rides in the line's colour. */
export interface NetworkShow {
  id: string;
  legs: { kind: "walk" | "ride"; color?: string; p: number[] }[];
}

/** What the hero's caption card says while a show is drawn. */
export interface NetworkCaption {
  id: string;
  label: string;
  durationS: number;
  distanceM: number;
  ride: { line: string; mode: string; color: string } | null;
}

const W = 1000;
const PAD = 30;
const CODE: Record<KnowledgeState, StateCode> = { verified: "v", barrier: "b", unverified: "r", unknown: "u" };

function parseLine(wkt: string): LonLat[] {
  return wkt
    .replace(/^LINESTRING\s*\(|\)$/g, "")
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number) as LonLat);
}

let cached: { data: NetworkData; aspect: number; captions: NetworkCaption[] } | null = null;

function build() {
  if (cached) return cached;
  const lines = graph.edges.map((e) => parseLine(e.wkt));
  const k = Math.cos((43.77 * Math.PI) / 180);
  const all = lines.flat();
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = (W - 2 * PAD) / (maxX - minX);
  const H = Math.round((maxY - minY) * scale + 2 * PAD);
  const project = ([lon, lat]: LonLat): [number, number] => [Math.round(PAD + (lon * k - minX) * scale), Math.round(PAD + (maxY - lat) * scale)];

  // Flatten a line, dropping points that round onto the one before; the ends are always kept so edges still meet.
  const flat = (pts: LonLat[]) => {
    const out: number[] = [];
    pts.forEach((p, i) => {
      const [x, y] = project(p);
      const n = out.length;
      if (n && i < pts.length - 1 && Math.abs(out[n - 2] - x) + Math.abs(out[n - 1] - y) < 3) return;
      if (n && out[n - 2] === x && out[n - 1] === y) return;
      out.push(x, y);
    });
    return out;
  };

  const hazards: Hazard[] = graph.hazards.map((h) => ({ ...h, segmentId: h.edge_id }) as unknown as Hazard);
  const edges = graph.edges
    .map((e, i) => {
      const state = segmentState({ id: e.id, evidence: e.evidence as Evidence[] }, DEFAULT_PREFERENCES, hazards);
      return [CODE[state], ...flat(lines[i])] as [StateCode, ...number[]];
    })
    .filter((e) => e.length >= 5);

  const routes = RouteResponse.parse(routesSample.response).routes.slice().sort((a, b) => a.rank - b.rank);
  const transit = TransitResponse.parse(transitSample.response).options.filter((o) => o.stepFree === "yes")[0];

  const shows: NetworkShow[] = [];
  const captions: NetworkCaption[] = [];
  const addWalk = (r: (typeof routes)[number]) => {
    shows.push({ id: r.id, legs: [{ kind: "walk", p: flat(r.geometry) }] });
    captions.push({ id: r.id, label: routeLabel(r.id), durationS: r.durationS, distanceM: r.distanceM, ride: null });
  };
  addWalk(routes[0]);
  if (transit) {
    const ride = transit.legs.find((l) => l.kind === "ride");
    shows.push({
      id: transit.id,
      legs: transit.legs.map((l) =>
        l.kind === "ride" ? { kind: "ride" as const, color: l.color ?? undefined, p: flat(l.geometry) } : { kind: "walk" as const, p: flat(l.route.geometry) },
      ),
    });
    captions.push({
      id: transit.id,
      label: "",
      durationS: transit.durationS,
      distanceM: transit.walkingM,
      ride: ride && ride.kind === "ride" ? { line: ride.line, mode: ride.mode, color: ride.color ?? "#D5C82B" } : null,
    });
  }
  routes.slice(1).forEach(addWalk);

  const first = routes[0].geometry;
  cached = {
    data: { w: W, h: H, edges, shows, origin: project(first[0]), destination: project(first.at(-1)!) },
    aspect: W / H,
    captions,
  };
  return cached;
}

/** The full picture, served as a static file so it never weighs on the page's first load. */
export function heroNetwork(): NetworkData {
  return build().data;
}

/** The small part the page needs up front: the picture's shape and the caption for each route. */
export function heroNetworkMeta() {
  const { aspect, captions, data } = build();
  return { aspect, captions, edgeCount: data.edges.length };
}
