import type { KnowledgeState, LonLat, Route } from "./api/contracts";

export interface Stretch {
  from: number; // metres along route
  to: number;
  state: KnowledgeState;
  shared: boolean;
  position: LonLat;
}

const SHARED_RADIUS_M = 20;

function metres(a: LonLat, b: LonLat) {
  const k = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(a[1] * k), b[1] - a[1]) * 111_320;
}

/**
 * Split each route into stretches that it shares with at least one other
 * alternative and stretches only it uses, keeping each stretch's state.
 */
export function divergence(routes: Route[]): Record<string, Stretch[]> {
  const out: Record<string, Stretch[]> = {};
  for (const r of routes) {
    const others = routes.filter((o) => o.id !== r.id).flatMap((o) => o.geometry);
    let along = 0;
    const stretches: Stretch[] = [];
    for (const s of r.segments) {
      const mid = r.geometry[Math.floor((s.from + s.to) / 2)];
      const shared = others.some((p) => metres(p, mid) < SHARED_RADIUS_M);
      const last = stretches[stretches.length - 1];
      if (last && last.shared === shared && last.state === s.state) last.to = along + s.lengthM;
      else stretches.push({ from: along, to: along + s.lengthM, state: s.state, shared, position: mid });
      along += s.lengthM;
    }
    out[r.id] = stretches;
  }
  return out;
}
