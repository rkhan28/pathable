import "server-only";
import corridor from "@/generated/fixtures/routes/corridor.json";
import type { KnowledgeState, LonLat, Preferences, Reason, RouteRequest } from "./api/contracts";
import { RouteResponse } from "./api/contracts";
import { rerank } from "./api/fixture-service";
import { DEFAULT_PREFERENCES, PROFILE_PRESETS } from "@/stores/preferences";
import { routeLabel } from "./route-label";

export const HERO_PROFILES = ["wheelchair", "walker", "cane"] as const;
export type HeroProfile = (typeof HERO_PROFILES)[number];
const PRESET: Record<HeroProfile, Partial<Preferences>> = {
  wheelchair: PROFILE_PRESETS.manual_wheelchair,
  walker: PROFILE_PRESETS.walker,
  cane: PROFILE_PRESETS.cane,
};
const STATE_CODE: Record<KnowledgeState, string> = { verified: "v", barrier: "b", unverified: "r", unknown: "u" };

export interface HeroData {
  generatedAt: string;
  origin: LonLat;
  destination: LonLat;
  routes: { id: string; label: string; geometry: LonLat[]; segments: [number, number, number][] }[];
  profiles: Record<HeroProfile, { order: string[]; states: Record<string, string>; reason: Reason | null }>;
}

const MIN_SPACING_M = 35;

function metres(a: LonLat, b: LonLat) {
  const k = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(a[1] * k), b[1] - a[1]) * 111_320;
}

/** Precompute the hero once at build: simplified geometry plus per-profile ranking. */
export function heroData(): HeroData {
  const response = RouteResponse.parse(corridor.response);
  const routes = response.routes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => {
      // Keep every segment boundary, thin interior points to about one per 35 m.
      const boundaries = new Set(r.segments.flatMap((s) => [s.from, s.to]));
      const keep: number[] = [];
      r.geometry.forEach((p, i) => {
        const last = keep.length ? r.geometry[keep[keep.length - 1]] : null;
        if (boundaries.has(i) || !last || metres(last, p) >= MIN_SPACING_M) keep.push(i);
      });
      const remap = new Map(keep.map((orig, idx) => [orig, idx]));
      return {
        id: r.id,
        label: routeLabel(r.id),
        geometry: keep.map((i) => [Number(r.geometry[i][0].toFixed(5)), Number(r.geometry[i][1].toFixed(5))] as LonLat),
        segments: r.segments.map((s) => [remap.get(s.from)!, remap.get(s.to)!, Math.round(s.lengthM)] as [number, number, number]),
      };
    });
  const profiles = Object.fromEntries(
    HERO_PROFILES.map((p) => {
      const request: RouteRequest = {
        origin: corridor.trip.origin as LonLat,
        destination: corridor.trip.destination as LonLat,
        preferences: { ...DEFAULT_PREFERENCES, ...PRESET[p] },
      };
      const ranked = rerank(response, request);
      return [
        p,
        {
          order: ranked.routes.map((r) => r.id),
          states: Object.fromEntries(ranked.routes.map((r) => [r.id, r.segments.map((s) => STATE_CODE[s.state]).join("")])),
          reason: ranked.routes[0].reasons[0] ?? null,
        },
      ];
    }),
  ) as HeroData["profiles"];
  return {
    generatedAt: response.generatedAt,
    origin: corridor.trip.origin as LonLat,
    destination: corridor.trip.destination as LonLat,
    routes,
    profiles,
  };
}
