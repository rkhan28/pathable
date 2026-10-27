"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";
import { PROFILE_ICONS } from "@/features/preferences/profiles";

/**
 * Hero illustration: a stylised street grid rotated 16.5° — the angle of
 * downtown Toronto's grid relative to true north. Changing the profile re-ranks
 * three routes, showing PathAble's core idea in one interaction.
 * It is an illustration (labelled as such), not map data.
 */

type DemoProfile = "manual_wheelchair" | "walker" | "cane";
type RouteKey = "A" | "B" | "C";

const STREETS_X = [60, 180, 300, 420, 540];
const STREETS_Y = [60, 160, 260, 360, 460];
const START = { x: 180, y: 460 };
const DEST = { x: 540, y: 160 };

const ROUTES: Record<RouteKey, string> = {
  A: "M180 460 V260 L300 160 H540",
  B: "M180 460 H420 V160 H540",
  C: "M180 460 H300 V360 H540 V160",
};

const SUGGESTED: Record<DemoProfile, RouteKey> = { manual_wheelchair: "C", walker: "B", cane: "A" };

function Block({ x, y, park }: { x: number; y: number; park?: boolean }) {
  return (
    <rect
      x={x + 13}
      y={y + 13}
      width={94}
      height={74}
      rx={10}
      className={park ? "fill-verified-soft stroke-verified/25" : "fill-surface-sunken stroke-border"}
      strokeWidth={1}
    />
  );
}

function Label({ x, y, children, tone = "neutral" }: { x: number; y: number; children: string; tone?: "neutral" | "accent" }) {
  // Counter-rotate so text stays level while the grid is rotated.
  const w = children.length * 7.6 + 22;
  return (
    <g transform={`translate(${x} ${y}) rotate(16.5)`}>
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} className={tone === "accent" ? "fill-primary" : "fill-surface-raised stroke-border"} />
      <text textAnchor="middle" dy="5" className={tone === "accent" ? "fill-primary-fg" : "fill-fg"} style={{ font: "600 13px var(--font-sans)" }}>
        {children}
      </text>
    </g>
  );
}

function HazardPin({ x, y, kind }: { x: number; y: number; kind: "stairs" | "ramp" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(16.5)`}>
      <circle r={15} className="fill-barrier stroke-surface-raised" strokeWidth={3} />
      {kind === "stairs" ? (
        <path d="M-7 6h4v-4h4v-4h4v-4h3" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M-7 5h5l6-6h3" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-7 -7 7 7" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export function HeroRouteDemo() {
  const t = useTranslations("landing.visual");
  const tProfiles = useTranslations("profiles");
  const reduced = usePrefersReducedMotion();
  const [profile, setProfile] = useState<DemoProfile>("manual_wheelchair");
  const titleId = useId();
  const descId = useId();
  const suggested = SUGGESTED[profile];
  const routeName: Record<RouteKey, string> = { A: t("routeA"), B: t("routeB"), C: t("routeC") };
  const explain: Record<DemoProfile, string> = {
    manual_wheelchair: t("explainWheelchair"),
    walker: t("explainWalker"),
    cane: t("explainCane"),
  };

  return (
    <figure className="relative flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-bg-subtle shadow-3">
        <svg viewBox="-30 -40 660 600" className="block h-auto w-full" role="img" aria-labelledby={`${titleId} ${descId}`}>
          <title id={titleId}>{t("label")}</title>
          <desc id={descId}>{t("summary", { profile: tProfiles(`${profile}.name`), route: routeName[suggested] })}</desc>
          <defs>
            <pattern id="hero-unknown" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="2" className="fill-unknown" />
            </pattern>
          </defs>
          <g transform="rotate(-16.5 300 260)">
            {/* streets */}
            {STREETS_X.map((x) => (
              <line key={`x${x}`} x1={x} y1={-40} x2={x} y2={560} className="stroke-surface" strokeWidth={22} />
            ))}
            {STREETS_Y.map((y) => (
              <line key={`y${y}`} x1={-40} y1={y} x2={640} y2={y} className="stroke-surface" strokeWidth={22} />
            ))}
            {/* blocks */}
            {STREETS_X.slice(0, -1).map((x) =>
              STREETS_Y.slice(0, -1).map((y) => <Block key={`${x}-${y}`} x={x} y={y} park={x === 180 && y === 160} />),
            )}
            {/* park path with stairs */}
            <path d="M180 260 L300 160" className="stroke-verified/30" strokeWidth={6} strokeDasharray="2 6" strokeLinecap="round" fill="none" />

            {/* alternatives first, then the suggested route on top */}
            {(["A", "B", "C"] as RouteKey[])
              .filter((k) => k !== suggested)
              .map((k) => (
                <path
                  key={k}
                  d={ROUTES[k]}
                  fill="none"
                  className="stroke-[var(--map-route-alt)]"
                  strokeWidth={5}
                  strokeDasharray="10 9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ))}
            <path d={ROUTES[suggested]} fill="none" className="stroke-surface-raised" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
            <motion.path
              key={suggested}
              d={ROUTES[suggested]}
              fill="none"
              className="stroke-[var(--map-route-selected)]"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* B's section with no data, drawn as dots so it never reads as verified */}
            {suggested === "B" ? <path d="M420 360 V260" stroke="url(#hero-unknown)" strokeWidth={9} fill="none" /> : null}
            {suggested === "B" ? <path d="M420 360 V260" className="stroke-surface-raised" strokeWidth={5} strokeDasharray="1 9" strokeLinecap="round" fill="none" /> : null}

            <HazardPin x={240} y={210} kind="stairs" />
            <HazardPin x={420} y={460} kind="ramp" />

            {/* origin ring + destination dot, echoing the logo */}
            <circle cx={START.x} cy={START.y} r={11} className="fill-surface-raised stroke-fg" strokeWidth={5} />
            <circle cx={DEST.x} cy={DEST.y} r={13} className="fill-accent stroke-surface-raised" strokeWidth={4} />

            <Label x={START.x - 4} y={START.y + 42}>{t("start")}</Label>
            <Label x={DEST.x + 6} y={DEST.y - 42} tone="accent">
              {t("destination")}
            </Label>
            <Label x={300} y={130}>{t("stairs")}</Label>
            <Label x={455} y={505}>{t("noRamp")}</Label>
          </g>
        </svg>
        <p className="absolute start-4 top-4 rounded-full bg-surface-raised/90 px-3 py-1 text-xs font-semibold text-fg-muted shadow-1">{t("caption")}</p>
      </div>

      <figcaption className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-fg-muted" id={`${titleId}-pick`}>
            {t("chooseProfile")}
          </span>
          <Segmented<DemoProfile>
            size="sm"
            label={t("chooseProfile")}
            value={profile}
            onValueChange={setProfile}
            options={(["manual_wheelchair", "walker", "cane"] as const).map((p) => {
              const Icon = PROFILE_ICONS[p];
              return { value: p, label: tProfiles(`${p}.short`), icon: <Icon aria-hidden="true" /> };
            })}
          />
        </div>
        <p className="min-h-[3.2em] max-w-prose text-fg-muted" aria-live="polite">
          <strong className="font-semibold text-fg">{routeName[suggested]}. </strong>
          {explain[profile]}
        </p>
      </figcaption>
    </figure>
  );
}
