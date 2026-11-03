"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FixtureBanner } from "@/components/site/fixture-banner";
import type { KnowledgeState } from "@/lib/api/contracts";
import type { HeroData, HeroProfile } from "@/lib/hero-data";
import { prefersReducedMotion } from "@/lib/motion";
import { announce } from "@/lib/announce";
import { hasWebGL } from "@/components/map/maplibre";
import type { MapRoute } from "@/components/map/route-layers";
import { HeroSvg } from "./hero-svg";

const RouteMap = dynamic(() => import("@/components/map/route-map").then((m) => m.RouteMap), { ssr: false });

const noopSubscribe = () => () => {};

const STATE: Record<string, KnowledgeState> = { v: "verified", b: "barrier", r: "unverified", u: "unknown" };

export function HeroMap({ data }: { data: HeroData }) {
  const t = useTranslations();
  const [profile, setProfile] = useState<HeroProfile>("wheelchair");
  // The live map only replaces the drawing when WebGL works and motion is allowed.
  const live = useSyncExternalStore(
    noopSubscribe,
    () => hasWebGL() && !prefersReducedMotion(),
    () => false,
  );

  const ranking = data.profiles[profile];
  const routes: MapRoute[] = useMemo(
    () =>
      data.routes.map((r) => ({
        id: r.id,
        geometry: r.geometry,
        segments: r.segments.map(([from, to, lengthM], i) => ({ from, to, lengthM, state: STATE[ranking.states[r.id][i]] })),
      })),
    [data.routes, ranking],
  );
  const top = data.routes.find((r) => r.id === ranking.order[0])!;
  const profileName = t(`landing.profile${profile[0].toUpperCase()}${profile.slice(1)}` as "landing.profileWheelchair");
  const reason = ranking.reason
    ? t(`reasons.${ranking.reason.code}`, { value: ranking.reason.value ?? 0 })
    : "";
  const explanation = t("landing.rankExplanation", { profile: profileName, label: top.label, reason });

  return (
    <div className="pa-hero-map">
      <div className="pa-hero-canvas domes-edge">
        <HeroSvg data={data} profile={profile} title={t("landing.heroMapLabel")} />
        {live && (
          <div className="absolute inset-0">
            <RouteMap
              routes={routes}
              selectedId={ranking.order[0]}
              origin={data.origin}
              destination={data.destination}
              label={t("landing.heroMapLabel")}
              interactive={false}
              controls={false}
              padding={{ top: 32, bottom: 32, left: 32, right: 32 }}
            />
          </div>
        )}
      </div>
      <div className="pa-hero-panel">
        <SegmentedControl
          legend={t("landing.rankFor")}
          value={profile}
          onChange={(p) => {
            setProfile(p);
            const next = data.profiles[p];
            const nextTop = data.routes.find((r) => r.id === next.order[0])!;
            const nextName = t(`landing.profile${p[0].toUpperCase()}${p.slice(1)}` as "landing.profileWheelchair");
            const nextReason = next.reason ? t(`reasons.${next.reason.code}`, { value: next.reason.value ?? 0 }) : "";
            announce(t("landing.rankExplanation", { profile: nextName, label: nextTop.label, reason: nextReason }));
          }}
          options={[
            { value: "wheelchair", label: t("onboarding.profiles.manual_wheelchair") },
            { value: "walker", label: t("onboarding.profiles.walker") },
            { value: "cane", label: t("onboarding.profiles.cane") },
          ]}
        />
        <p className="pa-hero-explanation">{explanation}</p>
        <FixtureBanner generatedAt={data.generatedAt} />
      </div>
    </div>
  );
}
