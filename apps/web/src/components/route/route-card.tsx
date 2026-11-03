"use client";

import { ChevronRight, CircleAlert, CircleCheck, CircleHelp, Navigation } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import type { Route } from "@/lib/api/contracts";
import { cn } from "@/lib/cn";
import { useRouteFormat } from "@/lib/format";
import { routeLabel } from "@/lib/route-label";
import { spring } from "@/lib/motion";
import { CoverageBar } from "./coverage-bar";

/**
 * One alternative. The whole card is a label for a native radio input, so the
 * list is a real radio group: arrow keys change the route and the map follows.
 */
export const RouteCard = memo(function RouteCard({
  route,
  name,
  selected,
  fixture,
  onSelect,
  onIsolate,
  onDetails,
  onStart,
}: {
  route: Route;
  name: string;
  selected: boolean;
  fixture: boolean;
  onSelect: (id: string) => void;
  onIsolate: (id: string | null) => void;
  onDetails: (id: string) => void;
  onStart: (id: string) => void;
}) {
  const t = useTranslations();
  const f = useRouteFormat();
  const label = routeLabel(route.id);
  const inputId = `route-${route.id}`;
  const Status = route.compatibility === "compatible" ? CircleCheck : route.compatibility === "incompatible" ? CircleAlert : CircleHelp;
  return (
    <motion.li
      layoutId={`route-card-${route.id}`}
      transition={spring.ui}
      className={cn("pa-route-card pa-card-in", selected && "is-selected")}
      onMouseEnter={() => onIsolate(route.id)}
      onMouseLeave={() => onIsolate(null)}
    >
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="radio"
          name={name}
          checked={selected}
          onChange={() => onSelect(route.id)}
          onFocus={() => onIsolate(route.id)}
          onBlur={() => onIsolate(null)}
          className="pa-route-radio"
          aria-describedby={`${inputId}-meta`}
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="pa-card-time tabular">
              <span className="sr-only">{t("route.label", { label })}, {t("route.time")}: </span>
              {f.minutes(route.durationS)}
            </span>
            <span className="tabular text-sm text-ink-muted">
              <span className="sr-only">{t("route.distance")}: </span>
              {f.distance(route.distanceM)}
            </span>
            <span className="ms-auto flex flex-wrap gap-1.5">
              {route.rank === 1 && <span className="pa-badge">{t("route.recommended")}</span>}
              {fixture && <span className="pa-badge is-fixture">{t("fixture.label")}</span>}
            </span>
          </span>
          <span id={`${inputId}-meta`} className={cn("pa-chip-status mt-2", `is-${route.compatibility}`)}>
            <Status aria-hidden size={14} />
            {route.barrierCount > 0 ? t("route.barriers", { count: route.barrierCount }) : t(`route.compatibilityShort.${route.compatibility}`)}
          </span>
        </label>
      </div>
      <div className="mt-3">
        <CoverageBar lengthByState={route.lengthByState} compact />
      </div>
      {selected && (
        <motion.div className="mt-3 flex flex-wrap gap-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={spring.ui}>
          <button type="button" className="pa-link-button flex-1 justify-center" onClick={() => onDetails(route.id)}>
            {t("route.more")}
            <ChevronRight aria-hidden size={18} className="rtl:rotate-180" />
          </button>
          <button type="button" className="pa-start-button flex-1" onClick={() => onStart(route.id)}>
            <Navigation aria-hidden size={18} />
            {t("route.start")}
          </button>
        </motion.div>
      )}
    </motion.li>
  );
});
