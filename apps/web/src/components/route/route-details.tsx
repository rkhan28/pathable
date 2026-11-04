"use client";

import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Tabs } from "radix-ui";
import { useEffect, useMemo, useRef } from "react";
import type { Evidence, LonLat, Route, Segment, Step } from "@/lib/api/contracts";
import { checkEvidence } from "@/lib/scoring";
import { useRouteFormat } from "@/lib/format";
import { routeLabel } from "@/lib/route-label";
import { spring } from "@/lib/motion";
import { usePreferences } from "@/stores/preferences";
import { StateIcon, STATE_TEXT_CLASS } from "./state-icon";
import { WhyThisRoute } from "./why-this-route";

export function useStepText() {
  const t = useTranslations("steps");
  return (step: Step) => {
    if (step.maneuver === "arrive") return t("arrive");
    return step.streetName ? t(step.maneuver, { street: step.streetName }) : t(`${step.maneuver}Unnamed`);
  };
}

function codeText(t: ReturnType<typeof useTranslations>, group: "surfaces" | "kerbValues", code: string) {
  const key = `${group}.${code.replaceAll(":", "_")}`;
  return t.has(key) ? t(key) : code.replaceAll("_", " ");
}

/** Within this many percentage points the two lidar surveys are said to agree; their median difference is 0.17. */
const SURVEYS_AGREE_PP = 1;

function EvidenceValue({ e }: { e: Evidence }) {
  const t = useTranslations();
  const f = useRouteFormat();
  if (e.value === null) return <span className="text-unknown">{t("route.evidenceUnknown")}</span>;
  let value: string;
  if (e.attribute === "running_slope" && typeof e.value === "number") {
    value = t("common.percent", { value: e.value });
  } else if (e.attribute === "width" && typeof e.value === "number") value = t("common.metres", { value: e.value });
  else if (typeof e.value === "boolean") value = e.value ? t("common.yes") : t("common.no");
  // Surface and curb values are OpenStreetMap codes; they are shown in the interface
  // language, and a code we have no word for yet is shown as it is rather than hidden.
  else if (e.attribute === "surface" && typeof e.value === "string") value = codeText(t, "surfaces", e.value);
  else if (e.attribute === "kerbs" && typeof e.value === "string") value = e.value.split(";").map((v) => codeText(t, "kerbValues", v)).join(" / ");
  else value = String(e.value).replaceAll(";", " / ");
  return (
    <span>
      <span className="tabular">{value}</span>
      {e.source && (
        <span className="block text-sm text-ink-muted">
          {t(`sources.${e.source}`)}
          <span className="block">{t("common.observed", { date: f.date(e.observedOn) })}</span>
        </span>
      )}
      {/* The second survey is a check on the first, so it is said in words rather than shown
          as a second number beside it. Slope only counts in ranking when both agree. */}
      {e.attribute === "running_slope" && typeof e.value === "number" && e.corroboration && (
        <span className="block text-sm text-ink-muted">
          {t(Math.abs(e.corroboration.value - e.value) <= SURVEYS_AGREE_PP ? "route.surveyAgrees" : "route.surveyDisagrees", {
            source: t(`sources.${e.corroboration.source}`),
            value: e.corroboration.value,
          })}
        </span>
      )}
    </span>
  );
}

interface Section {
  key: string;
  street: string | null;
  kind: Segment["kind"];
  lengthM: number;
  segments: Segment[];
  at: number;
}

function groupSections(route: Route): Section[] {
  const out: Section[] = [];
  for (const s of route.segments) {
    const last = out[out.length - 1];
    if (last && last.street === s.streetName && last.kind === s.kind) {
      last.lengthM += s.lengthM;
      last.segments.push(s);
    } else {
      out.push({ key: s.id, street: s.streetName, kind: s.kind, lengthM: s.lengthM, segments: [s], at: s.from });
    }
  }
  return out;
}

export function RouteDetails({
  route,
  onBack,
  onShowOnMap,
  onStartGuidance,
  total,
}: {
  route: Route;
  total: number;
  onBack: () => void;
  onShowOnMap: (position: LonLat) => void;
  onStartGuidance: () => void;
}) {
  const t = useTranslations();
  const f = useRouteFormat();
  const stepText = useStepText();
  const prefs = usePreferences((s) => s.preferences);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sections = useMemo(() => groupSections(route), [route]);
  const label = routeLabel(route.id);

  // Focus moves to the new heading when the view changes.
  useEffect(() => headingRef.current?.focus(), [route.id]);

  return (
    <motion.section layoutId={`route-card-${route.id}`} transition={spring.ui} className="pa-details" aria-labelledby="details-title">
      <div className="flex items-center gap-2">
        <button type="button" className="pa-icon-button" onClick={onBack} aria-label={t("route.backToRoutes")}>
          <ArrowLeft aria-hidden size={20} className="rtl:rotate-180" />
        </button>
        <h2 id="details-title" ref={headingRef} tabIndex={-1} className="text-lg outline-none">
          {t("route.label", { label })}
        </h2>
        <span className="pa-route-stats ms-auto">
          <span className="tabular">{f.distance(route.distanceM)}</span>
          <span className="tabular">{f.minutes(route.durationS)}</span>
        </span>
      </div>

      {/* What used to crowd the route card lives here, where there is room for it. */}
      <div className="mt-3 grid gap-1 text-sm">
        <p className={route.compatibility === "incompatible" ? "font-bold text-barrier" : undefined}>{t(`route.compatibility.${route.compatibility}`)}</p>
        <p className="text-ink-muted">
          {t("route.reports", { count: route.reportCount })}. {t("route.freshness", { oldest: f.date(route.oldestObservation), newest: f.date(route.newestObservation) })}
        </p>
        <WhyThisRoute reasons={route.reasons} rank={route.rank} total={total} />
      </div>

      <Tabs.Root defaultValue="directions" className="mt-4">
        <Tabs.List className="pa-tabs" aria-label={t("route.details")}>
          <Tabs.Trigger value="directions" className="pa-tab">{t("route.tabs.directions")}</Tabs.Trigger>
          <Tabs.Trigger value="sections" className="pa-tab">{t("route.tabs.sections")}</Tabs.Trigger>
          <Tabs.Trigger value="hazards" className="pa-tab">{t("route.tabs.hazards")}</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="directions" className="pa-tab-panel">
          <ol className="pa-step-list">
            {route.steps.map((step, i) => (
              <li key={i} className="pa-step-item">
                <span className="pa-step-number tabular" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{stepText(step)}</p>
                  {step.distanceM > 0 && <p className="tabular text-sm text-ink-muted">{f.distance(step.distanceM)}</p>}
                  {step.notes.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {step.notes.map((n) => (
                        <li key={n} className="pa-note">
                          {t(`steps.notes.${n}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="pa-icon-button" onClick={() => onShowOnMap(route.geometry[step.at])} aria-label={`${t("common.showOnMap")}: ${stepText(step)}`}>
                  <MapPin aria-hidden size={18} />
                </button>
              </li>
            ))}
          </ol>
        </Tabs.Content>

        <Tabs.Content value="sections" className="pa-tab-panel">
          <ul className="grid gap-3">
            {sections.map((sec) => {
              const states = new Set(sec.segments.map((s) => s.state));
              const worst = states.has("barrier") ? "barrier" : states.has("unverified") ? "unverified" : states.has("unknown") ? "unknown" : "verified";
              const evidence = sec.segments[0].evidence;
              return (
                <li key={sec.key} className="pa-section-card">
                  <div className="flex items-start gap-2">
                    <StateIcon state={worst} className={`mt-0.5 ${STATE_TEXT_CLASS[worst]}`} />
                    <p className="flex-1 font-bold">
                      {t("route.sectionLength", { length: f.distance(sec.lengthM), street: sec.street ?? t("route.unnamed") })}
                      <span className="sr-only">, {t(`states.${worst}`)}</span>
                    </p>
                    <button type="button" className="pa-icon-button -m-2" onClick={() => onShowOnMap(route.geometry[sec.at])} aria-label={`${t("common.showOnMap")}: ${sec.street ?? t("route.unnamed")}`}>
                      <MapPin aria-hidden size={18} />
                    </button>
                  </div>
                  <dl className="pa-evidence">
                    {evidence.map((e) => {
                      const check = checkEvidence(e, prefs);
                      return (
                        <div key={e.attribute}>
                          <dt className="flex items-center gap-1.5">
                            {check && <StateIcon state={check === "pass" ? "verified" : check === "fail" ? "barrier" : "unknown"} size={14} className={check === "pass" ? "text-verified" : check === "fail" ? "text-barrier" : "text-unknown"} />}
                            {t(`attributes.${e.attribute}`)}
                          </dt>
                          <dd>
                            <EvidenceValue e={e} />
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </li>
              );
            })}
          </ul>
        </Tabs.Content>

        <Tabs.Content value="hazards" className="pa-tab-panel">
          {route.hazards.length === 0 ? (
            <p className="text-ink-muted">{t("route.noHazards")}</p>
          ) : (
            <ul className="grid gap-3">
              {route.hazards.map((h) => (
                <li key={h.id} className="pa-section-card flex items-start gap-3">
                  <span className={h.status === "verified" ? "pa-hazard-dot is-verified" : "pa-hazard-dot is-reported"} aria-hidden />
                  <div className="flex-1">
                    <p className="font-bold">{t(`hazards.kinds.${h.kind}`)}</p>
                    <p className="text-sm">{t(`hazards.status.${h.status}`)}</p>
                    <p className="text-sm text-ink-muted">{t("hazards.measured", { source: t(`sources.${h.source}`), date: f.date(h.observedOn) })}</p>
                  </div>
                  <button type="button" className="pa-icon-button" onClick={() => onShowOnMap(h.location)} aria-label={`${t("common.showOnMap")}: ${t(`hazards.kinds.${h.kind}`)}`}>
                    <MapPin aria-hidden size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <button type="button" className="pa-start-button mt-4 w-full" onClick={onStartGuidance}>
        <Navigation aria-hidden size={18} />
        {t("route.start")}
      </button>
    </motion.section>
  );
}
