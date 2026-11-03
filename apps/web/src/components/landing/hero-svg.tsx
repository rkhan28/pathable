import type { LonLat } from "@/lib/api/contracts";
import type { HeroData, HeroProfile } from "@/lib/hero-data";

const STATE_STROKE: Record<string, { color: string; dash?: string; cap: "round" | "butt" }> = {
  v: { color: "var(--signal)", cap: "round" },
  b: { color: "var(--state-barrier)", cap: "round" },
  r: { color: "var(--state-unverified)", dash: "6 4", cap: "butt" },
  u: { color: "var(--state-unknown)", dash: "0.1 6", cap: "round" },
};

/**
 * Static drawing of the hero routes: the fallback when WebGL is missing or
 * motion is reduced, and the first paint before the map loads. Same encoding
 * as the map: colour plus pattern, with the selected route on top.
 */
export function HeroSvg({ data, profile, title, highlight, onlySelected = false, weight = 1 }: { data: HeroData; profile: HeroProfile; title: string; highlight?: string; onlySelected?: boolean; weight?: number }) {
  const W = 800;
  const H = 520;
  const pad = 40;
  const all = data.routes.flatMap((r) => r.geometry);
  const k = Math.cos((43.77 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const project = ([lon, lat]: LonLat) => [ox + (lon * k - minX) * scale, oy + (maxY - lat) * scale] as const;
  const path = (pts: LonLat[]) => pts.map((p, i) => `${i ? "L" : "M"}${project(p).map((n) => n.toFixed(1)).join(" ")}`).join("");

  const ranking = data.profiles[profile];
  const selectedId = ranking.order[0];
  const ordered = [...data.routes].sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0));
  const [ox1, oy1] = project(data.origin);
  const [dx, dy] = project(data.destination);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {ordered.map((r) => {
        if (r.id !== selectedId) {
          if (onlySelected) return null;
          return (
            <g key={r.id}>
              <path d={path(r.geometry)} fill="none" stroke="var(--route-casing)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              <path d={path(r.geometry)} fill="none" stroke="var(--route-alt)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        }
        const states = ranking.states[r.id];
        // Merge consecutive segments in the same state into one path each.
        const runs: { state: string; pts: LonLat[] }[] = [];
        r.segments.forEach(([from, to], i) => {
          const state = states[i];
          const pts = r.geometry.slice(from, to + 1);
          const last = runs[runs.length - 1];
          if (last && last.state === state) last.pts.push(...pts.slice(1));
          else runs.push({ state, pts });
        });
        return (
          <g key={r.id}>
            <path d={path(r.geometry)} fill="none" stroke="var(--route-casing)" strokeWidth={11 * weight} strokeLinecap="round" strokeLinejoin="round" />
            {runs.map((run, i) => {
              const s = STATE_STROKE[run.state];
              return (
                <g key={i} opacity={highlight && run.state !== highlight ? 0.16 : 1}>
                  <path d={path(run.pts)} fill="none" stroke={s.color} strokeWidth={6 * weight} strokeDasharray={s.dash} strokeLinecap={s.cap} strokeLinejoin="round" />
                  {run.state === "b" && <path d={path(run.pts)} fill="none" stroke="var(--route-casing)" strokeWidth={1.6} strokeLinecap="round" />}
                </g>
              );
            })}
          </g>
        );
      })}
      <circle cx={ox1} cy={oy1} r={7} fill="var(--surface-raised)" stroke="var(--brand)" strokeWidth={3.5} />
      <circle cx={dx} cy={dy} r={8} fill="var(--brand)" stroke="var(--surface-raised)" strokeWidth={2.5} />
    </svg>
  );
}
