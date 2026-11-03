"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Route } from "@/lib/api/contracts";
import { cn } from "@/lib/cn";
import { useRouteFormat } from "@/lib/format";
import { routeLabel } from "@/lib/route-label";
import { spring } from "@/lib/motion";
import { CoverageBar } from "./coverage-bar";
import { WhyThisRoute } from "./why-this-route";

/**
 * One alternative. The whole card is a label for a native radio input, so the
 * list is a real radio group: arrow keys change the route and the map follows.
 */
export function RouteCard({
  route,
  total,
  name,
  selected,
  fixture,
  onSelect,
  onIsolate,
  onDetails,
}: {
  route: Route;
  total: number;
  name: string;
  selected: boolean;
  fixture: boolean;
  onSelect: () => void;
  onIsolate: (on: boolean) => void;
  onDetails: () => void;
}) {
  const t = useTranslations();
  const f = useRouteFormat();
  const label = routeLabel(route.id);
  const inputId = `route-${route.id}`;
  return (
    <motion.li
      layoutId={`route-card-${route.id}`}
      transition={spring.ui}
      className={cn("pa-route-card", selected && "is-selected")}
      onMouseEnter={() => onIsolate(true)}
      onMouseLeave={() => onIsolate(false)}
    >
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
          onFocus={() => onIsolate(true)}
          onBlur={() => onIsolate(false)}
          className="pa-route-radio"
          aria-describedby={`${inputId}-meta`}
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-md font-bold">{t("route.label", { label })}</span>
            {route.rank === 1 && <span className="pa-badge">{t("route.recommended")}</span>}
            {fixture && <span className="pa-badge is-fixture">{t("fixture.label")}</span>}
          </span>
          <span id={`${inputId}-meta`} className="mt-1 block">
            <span className="pa-route-stats">
              <span>
                <span className="sr-only">{t("route.distance")}: </span>
                <span className="tabular">{f.distance(route.distanceM)}</span>
              </span>
              <span>
                <span className="sr-only">{t("route.time")}: </span>
                <span className="tabular">{f.minutes(route.durationS)}</span>
              </span>
            </span>
            <span className={cn("pa-compat", `is-${route.compatibility}`)}>{t(`route.compatibility.${route.compatibility}`)}</span>
          </span>
        </label>
      </div>
      <div className="mt-3">
        <CoverageBar lengthByState={route.lengthByState} compact={!selected} />
      </div>
      {selected && (
        <div className="mt-3 grid gap-2 text-sm">
          <p className={route.barrierCount ? "font-bold text-barrier" : undefined}>{t("route.barriers", { count: route.barrierCount })}</p>
          <p>{t("route.reports", { count: route.reportCount })}</p>
          <p className="text-ink-muted">
            {t("route.freshness", { oldest: f.date(route.oldestObservation), newest: f.date(route.newestObservation) })}
          </p>
          <WhyThisRoute reasons={route.reasons} rank={route.rank} total={total} />
          <button type="button" className="pa-link-button mt-1 justify-between" onClick={onDetails}>
            {t("route.details")}
            <ChevronRight aria-hidden size={18} className="rtl:rotate-180" />
          </button>
        </div>
      )}
    </motion.li>
  );
}
