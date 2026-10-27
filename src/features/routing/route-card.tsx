"use client";

import { CheckIcon, ChevronRightIcon, CircleCheckIcon, CircleHelpIcon, OctagonXIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import type { Route } from "@/api/contracts";
import { Badge } from "@/components/ui/feedback";
import { formatDistance, formatDuration, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoverageBar } from "./coverage-bar";

export const COMPATIBILITY_ICON: Record<Route["compatibility"]["level"], { icon: LucideIcon; className: string }> = {
  meets: { icon: CircleCheckIcon, className: "text-verified" },
  partial: { icon: TriangleAlertIcon, className: "text-unverified" },
  conflicts: { icon: OctagonXIcon, className: "text-barrier" },
  insufficient_data: { icon: CircleHelpIcon, className: "text-unknown" },
};

interface RouteCardProps {
  route: Route;
  selected: boolean;
  onSelect: () => void;
  onDetails: () => void;
  name: string;
  sample: boolean;
}

/**
 * One option in the route radiogroup. The native radio gets a concise
 * accessible name; the full breakdown is linked via aria-describedby.
 * Arrow keys move between options (native radio behaviour) and update the map.
 */
export function RouteCard({ route, selected, onSelect, onDetails, name, sample }: RouteCardProps) {
  const t = useTranslations("routes");
  const tBackend = useTranslations("backend");
  const locale = useLocale();
  const id = useId();
  const { summary, compatibility, recommendation } = route;
  const distance = formatDistance(summary.distanceMeters, locale);
  const duration = formatDuration(summary.durationSeconds, locale);
  const suggested = recommendation.rank === 1;
  const Compat = COMPATIBILITY_ICON[compatibility.level];

  const facts = [
    t("barriers", { count: summary.knownBarrierCount }),
    t("unverified", { count: summary.unverifiedReportCount }),
    t("verifiedShare", { percent: formatPercent(summary.coverage.verified_accessible, locale) }),
    t("unknownShare", { percent: formatPercent(summary.coverage.unknown, locale) }),
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-surface-raised transition-[border-color,box-shadow] duration-200",
        selected ? "border-fg shadow-3" : "border-border shadow-1 hover:border-border-strong",
      )}
    >
      <label htmlFor={`${id}-radio`} className="block cursor-pointer rounded-lg p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
        <input
          id={`${id}-radio`}
          type="radio"
          name="route-option"
          className="sr-only"
          checked={selected}
          onChange={onSelect}
          aria-label={`${t("option", { rank: recommendation.rank })}${suggested ? `, ${t("suggested")}` : ""}: ${distance}, ${t("durationApprox", { duration: formatDuration(summary.durationSeconds, locale, "long") })}. ${t(`compatibility.${compatibility.level}`)}.`}
          aria-describedby={`${id}-facts`}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{name}</span>
            {suggested ? <Badge tone="success">{t("suggested")}</Badge> : null}
            {sample ? <Badge tone="warning">{tBackend("sampleBadge")}</Badge> : null}
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full border-2",
              selected ? "border-fg bg-fg text-fg-inverse" : "border-border-strong",
            )}
          >
            {selected ? <CheckIcon className="size-3.5" strokeWidth={3.5} /> : null}
          </span>
        </div>

        <p className="mt-2 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular">{distance}</span>
          <span className="text-fg-muted">{t("durationApprox", { duration })}</span>
        </p>

        <p className={cn("mt-1.5 flex items-center gap-1.5 text-sm font-semibold", Compat.className)}>
          <Compat.icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-fg">{t(`compatibilityShort.${compatibility.level}`)}</span>
        </p>

        <CoverageBar coverage={summary.coverage} className="mt-3" />
        <ul id={`${id}-facts`} className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-fg-muted">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </label>
      {selected ? (
        <div className="border-t border-border px-2 py-1.5">
          <button
            type="button"
            onClick={onDetails}
            className="flex min-h-11 w-full items-center justify-between rounded-md px-2 font-semibold text-accent hover:bg-bg-subtle"
          >
            {t("details.title")}
            <ChevronRightIcon className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
