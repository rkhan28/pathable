"use client";

import { ChevronRight, CircleCheck, CircleHelp, Footprints, Navigation } from "lucide-react";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, memo } from "react";
import type { TransitLeg, TransitOption } from "@/lib/api/contracts";
import { cn } from "@/lib/cn";
import { useRouteFormat } from "@/lib/format";
import { spring } from "@/lib/motion";
import { MODE_ICON, inkOn } from "@/components/navigate/maneuver-icon";

/** The legs as a row of chips: walk 4 min, then the 41 bus, then walk 2 min. */
export function LegChips({ legs }: { legs: TransitLeg[] }) {
  const t = useTranslations("transit");
  const f = useRouteFormat();
  return (
    <span className="pa-legs">
      {legs.map((leg, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight aria-hidden size={14} className="pa-legs-sep rtl:rotate-180" />}
          {leg.kind === "walk" ? (
            <span className="pa-leg is-walk">
              <Footprints aria-hidden size={14} />
              <span className="tabular">{Math.max(1, Math.round(leg.route.durationS / 60))}</span>
              <span className="sr-only">{t("walkLeg", { minutes: f.minutes(leg.route.durationS) })}</span>
            </span>
          ) : (
            <RideChip leg={leg} />
          )}
        </Fragment>
      ))}
    </span>
  );
}

function RideChip({ leg }: { leg: Extract<TransitLeg, { kind: "ride" }> }) {
  const t = useTranslations("transit");
  const Icon = MODE_ICON[leg.mode];
  const style = leg.color ? { background: leg.color, color: inkOn(leg.color) } : undefined;
  return (
    <span className="pa-leg is-ride" style={style}>
      <Icon aria-hidden size={14} />
      <span aria-hidden>{leg.line}</span>
      <span className="sr-only">{t("rideLeg", { mode: leg.mode, line: leg.line })}</span>
    </span>
  );
}

export const TransitCard = memo(function TransitCard({
  option,
  name,
  selected,
  fixture,
  fastest,
  onSelect,
  onStart,
}: {
  option: TransitOption;
  name: string;
  selected: boolean;
  fixture: boolean;
  fastest: boolean;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
}) {
  const t = useTranslations();
  const f = useRouteFormat();
  const format = useFormatter();
  const time = (iso: string) => format.dateTime(new Date(iso), { hour: "numeric", minute: "2-digit" });
  const ride = option.legs.find((l) => l.kind === "ride");
  const inputId = `transit-${option.id}`;
  return (
    <motion.li
      layout="position"
      transition={spring.ui}
      className={cn("pa-route-card pa-card-in", selected && "is-selected")}
    >
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="radio"
          name={name}
          checked={selected}
          onChange={() => onSelect(option.id)}
          className="pa-route-radio"
          aria-describedby={`${inputId}-meta`}
        />
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
          <span className="flex items-baseline gap-2">
            <span className="pa-card-time tabular">{f.minutes(option.durationS)}</span>
            <span className="tabular text-sm text-ink-muted">{t("transit.arrive", { time: time(option.arriveAt) })}</span>
            {fastest && <span className="pa-badge ms-auto">{t("transit.faster")}</span>}
            {fixture && <span className="pa-badge is-fixture">{t("fixture.label")}</span>}
          </span>
          <span id={`${inputId}-meta`} className="mt-2 block">
            <LegChips legs={option.legs} />
            {ride?.kind === "ride" && (
              <span className="mt-2 block text-sm">
                {t("transit.leaves", { time: time(ride.departAt) })}
                <span className="text-ink-muted">, {ride.from.name}</span>
              </span>
            )}
            <span className={cn("pa-chip-status mt-2", option.stepFree === "yes" ? "is-good" : "is-unknown")}>
              {option.stepFree === "yes" ? <CircleCheck aria-hidden size={14} /> : <CircleHelp aria-hidden size={14} />}
              {t(`transit.stepFree.${option.stepFree}`)}
            </span>
          </span>
        </label>
      </div>
      {selected && (
        <motion.div
          className="mt-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={spring.ui}
        >
          <button type="button" className="pa-start-button" onClick={() => onStart(option.id)}>
            <Navigation aria-hidden size={18} />
            {t("route.start")}
          </button>
        </motion.div>
      )}
    </motion.li>
  );
});
