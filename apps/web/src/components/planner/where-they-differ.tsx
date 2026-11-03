"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { LonLat, Route } from "@/lib/api/contracts";
import { divergence } from "@/lib/divergence";
import { routeLabel } from "@/lib/route-label";

const FILL = { verified: "var(--signal)", barrier: "var(--state-barrier)", unverified: "url(#pa-pattern-unverified)", unknown: "url(#pa-pattern-unknown)" };

/** One row per route; stretches only that route uses are drawn in their state, shared ones faded. */
export function WhereTheyDiffer({ routes, onShow }: { routes: Route[]; onShow: (p: LonLat) => void }) {
  const t = useTranslations();
  const rows = useMemo(() => divergence(routes), [routes]);
  const longest = Math.max(...routes.map((r) => r.distanceM));
  if (routes.length < 2) return null;
  return (
    <section aria-labelledby="differ-title" className="mt-6">
      <h3 id="differ-title" className="font-bold">
        {t("planner.whereTheyDiffer")}
      </h3>
      <ul className="mt-2 grid gap-2">
        {[...routes].sort((a, b) => a.id.localeCompare(b.id)).map((r) => {
          const own = rows[r.id].filter((s) => !s.shared);
          return (
            <li key={r.id} className="flex items-center gap-3">
              <span className="w-6 font-bold">{routeLabel(r.id)}</span>
              <svg viewBox={`0 0 ${longest} 10`} preserveAspectRatio="none" className="pa-differ-bar" aria-hidden>
                {rows[r.id].map((s, i) => (
                  <rect key={i} x={s.from} width={s.to - s.from} y={s.shared ? 3.5 : 0} height={s.shared ? 3 : 10} fill={s.shared ? "var(--line-subtle)" : FILL[s.state]} />
                ))}
              </svg>
              {own.length > 0 && (
                <button type="button" className="pa-chip-button -my-2 text-sm" onClick={() => onShow(own[0].position)} aria-label={`${t("common.showOnMap")}: ${t("route.label", { label: routeLabel(r.id) })}, ${t("planner.whereTheyDiffer")}`}>
                  {t("common.showOnMap")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
