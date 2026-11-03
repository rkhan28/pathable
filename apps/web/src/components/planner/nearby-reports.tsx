"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LonLat, Route } from "@/lib/api/contracts";
import { getService } from "@/lib/api/select-service";
import { useRouteFormat } from "@/lib/format";

const MARGIN_DEG = 0.003; // about 300 m around the route

function bbox(route: Route): [number, number, number, number] {
  const xs = route.geometry.map((p) => p[0]);
  const ys = route.geometry.map((p) => p[1]);
  return [Math.min(...xs) - MARGIN_DEG, Math.min(...ys) - MARGIN_DEG, Math.max(...xs) + MARGIN_DEG, Math.max(...ys) + MARGIN_DEG];
}

/** Community reports near the selected route, newest first. Measured hazards live in route details. */
export function NearbyReports({ route, onShow }: { route: Route; onShow: (p: LonLat) => void }) {
  const t = useTranslations();
  const f = useRouteFormat();
  const box = bbox(route);
  const query = useQuery({
    queryKey: ["hazards", box.map((n) => n.toFixed(4)).join(",")],
    queryFn: async ({ signal }) => (await getService()).hazards(box, signal),
    staleTime: 60_000,
  });
  const reports = (query.data?.hazards ?? [])
    .filter((h) => h.source === "community-report")
    .sort((a, b) => b.observedOn.localeCompare(a.observedOn));

  return (
    <section aria-labelledby="reports-title" className="mt-6" aria-busy={query.isPending}>
      <h3 id="reports-title" className="font-bold">
        {t("planner.nearbyReports")}
      </h3>
      {query.isPending ? (
        <div className="pa-skeleton-line mt-2" aria-hidden />
      ) : reports.length === 0 ? (
        <p className="mt-1 text-ink-muted">{t("planner.noReports")}</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {reports.map((h) => (
            <li key={h.id} className="pa-section-card flex items-start gap-3">
              <span className={h.status === "verified" ? "pa-hazard-dot is-verified mt-1" : "pa-hazard-dot is-reported mt-1"} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t(`hazards.kinds.${h.kind}`)}</p>
                <p className="text-sm">{t(`hazards.status.${h.status}`)}</p>
                <p className="text-sm text-ink-muted">
                  {t("common.observed", { date: f.date(h.observedOn) })}
                  {h.expiresAt ? `. ${t("hazards.expires", { date: f.date(h.expiresAt.slice(0, 10)) })}` : ""}
                </p>
              </div>
              <button type="button" className="pa-icon-button" onClick={() => onShow(h.location)} aria-label={`${t("common.showOnMap")}: ${t(`hazards.kinds.${h.kind}`)}`}>
                <MapPin aria-hidden size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
