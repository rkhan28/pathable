"use client";

import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CornerUpLeftIcon,
  CornerUpRightIcon,
  FlagIcon,
  LocateIcon,
  MoveUpLeftIcon,
  MoveUpRightIcon,
  NavigationIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LatLng, Route, RouteStep } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { HazardDetails } from "@/features/hazards/hazard-details";
import { WinterAdvisory } from "@/features/hazards/winter-advisory";
import { formatDistance, formatRelativeTime } from "@/lib/format";
import { SEGMENT_STYLE, SegmentSwatch, StatusIcon } from "./status-visuals";
import { useStepText } from "./use-step-text";

export function ManeuverIcon({ step, className }: { step: RouteStep; className?: string }) {
  const props = { className, "aria-hidden": true } as const;
  const { type, modifier } = step.maneuver;
  if (type === "depart") return <NavigationIcon {...props} />;
  if (type === "arrive") return <FlagIcon {...props} />;
  if (type === "turn" && modifier === "left") return <CornerUpLeftIcon {...props} />;
  if (type === "turn" && modifier === "right") return <CornerUpRightIcon {...props} />;
  if (type === "turn" && modifier === "slight_left") return <MoveUpLeftIcon {...props} />;
  if (type === "turn" && modifier === "slight_right") return <MoveUpRightIcon {...props} />;
  return <ArrowUpIcon {...props} />;
}

export function RouteDetails({
  route,
  onBack,
  onShowOnMap,
  onStartGuidance,
  sample,
}: {
  route: Route;
  onBack: () => void;
  onShowOnMap: (location: LatLng) => void;
  onStartGuidance: () => void;
  sample: boolean;
}) {
  const t = useTranslations("routes");
  const tNav = useTranslations("navigate");
  const tDir = useTranslations("directions");
  const tHaz = useTranslations("hazards");
  const tCommon = useTranslations("common");
  const tBackend = useTranslations("backend");
  const locale = useLocale();
  const step = useStepText();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="md" className="-ms-3 px-3" onClick={onBack}>
          <ArrowLeftIcon className="rtl:rotate-180" aria-hidden="true" />
          {tNav("backToRoutes")}
        </Button>
        <Button onClick={onStartGuidance}>{tNav("startGuidance")}</Button>
      </div>
      <h2 className="text-title font-semibold" id="route-details-title" tabIndex={-1}>
        {t("details.title")}: {t("option", { rank: route.recommendation.rank })}
        {sample ? <Badge tone="warning" className="ms-2 align-middle">{tBackend("sampleBadge")}</Badge> : null}
      </h2>

      <WinterAdvisory hazards={route.hazards} />

      <Tabs defaultValue="directions">
        <TabsList className="w-full">
          <TabsTrigger value="directions">{t("details.tabs.directions")}</TabsTrigger>
          <TabsTrigger value="sections">{t("details.tabs.sections")}</TabsTrigger>
          <TabsTrigger value="hazards">
            {t("details.tabs.hazards")}
            <span className="rounded-full bg-bg-subtle px-1.5 text-xs font-semibold tabular">{route.hazards.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directions" className="mt-4">
          <ol aria-label={tDir("listLabel")} className="flex flex-col">
            {route.steps.map((s, i) => {
              return (
                <li key={i} className="flex gap-3 border-b border-border py-3 last:border-b-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg-subtle">
                    <ManeuverIcon step={s} className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="font-medium leading-snug">{step.instruction(s)}</p>
                    {s.notes.length ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {s.notes.map((n) => (
                          <li key={n}>
                            <Badge tone={n === "known_barrier_ahead" ? "danger" : n === "unverified_section" || n === "steep_section" ? "warning" : "success"}>{step.note(n)}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t("details.showOnMap")}: ${step.maneuver(s)}`} onClick={() => onShowOnMap(s.location)}>
                    <LocateIcon aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ol>
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <ol className="flex flex-col">
            {route.segments.map((seg, i) => {
              const mid = route.geometry.coordinates[Math.floor((seg.startIndex + seg.endIndex) / 2)];
              const facts = [
                seg.maxSlopePercent !== null ? t("details.slope", { value: seg.maxSlopePercent }) : null,
                seg.minWidthCm !== null ? t("details.width", { value: seg.minWidthCm }) : null,
                t(`details.surface.${seg.surface}`),
                tHaz(`sources.${seg.source}`),
                seg.observedAt ? tCommon("observed", { when: formatRelativeTime(seg.observedAt, locale) }) : null,
              ].filter(Boolean);
              return (
                <li key={seg.id} className="flex gap-3 border-b border-border py-3 last:border-b-0">
                  <span className="flex w-10 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                    <StatusIcon status={seg.status} className="size-5" />
                    <SegmentSwatch status={seg.status} width={30} />
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold ${SEGMENT_STYLE[seg.status].textClass}`}>
                      <span className="sr-only">{i + 1}. </span>
                      {t("details.sectionLine", { status: t(`segments.${seg.status}`), length: formatDistance(seg.lengthMeters, locale) })}
                    </p>
                    <p className="text-sm text-fg-muted">{facts.join(", ")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t("details.showOnMap")}: ${t(`segments.${seg.status}`)} ${i + 1}`}
                    onClick={() => onShowOnMap({ lng: mid[0], lat: mid[1] })}
                  >
                    <LocateIcon aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ol>
        </TabsContent>

        <TabsContent value="hazards" className="mt-4">
          {route.hazards.length === 0 ? (
            <p className="rounded-lg bg-bg-subtle p-4 text-fg-muted">{t("details.noHazards")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {route.hazards.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                  <HazardDetails hazard={h} />
                  <Button variant="ghost" size="icon-sm" aria-label={`${t("details.showOnMap")}: ${tHaz(`types.${h.type}`)}`} onClick={() => onShowOnMap(h.location)}>
                    <LocateIcon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      <p className="text-sm text-fg-muted">{t("never100")}</p>
    </div>
  );
}
