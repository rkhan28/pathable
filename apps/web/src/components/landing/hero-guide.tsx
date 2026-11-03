"use client";

import { Accessibility, Eye, Footprints, PersonStanding, TrainFront } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StepIcon } from "@/components/navigate/maneuver-icon";
import { useStepText } from "@/components/route/route-details";
import type { Step } from "@/lib/api/contracts";
import type { GuideData } from "@/lib/guide-data";
import { useRouteFormat } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { usePreferences, type Profile } from "@/stores/preferences";

/** One walk through the route takes this long; then it rests and starts again. */
const LOOP_MS = 14_000;
const REST_MS = 1_800;
/** Without motion, the phone shows the route part-way along, at this step. */
const STILL_STEP = 2;

const noopSubscribe = () => () => {};

const PICKS: { profile: Profile; icon: typeof Accessibility }[] = [
  { profile: "manual_wheelchair", icon: Accessibility },
  { profile: "walker", icon: PersonStanding },
  { profile: "cane", icon: Footprints },
  { profile: "blind_low_vision", icon: Eye },
];

/**
 * The landing's picture of the product: a phone giving guidance along a real
 * route, with the instruction changing as the dot reaches each real step.
 * Decorative for assistive technology (the same facts are in the text
 * beside it); the profile picker under it is real and saves on this device.
 */
export function HeroGuide({ data }: { data: GuideData }) {
  const t = useTranslations();
  const f = useRouteFormat();
  const stepText = useStepText();
  const still = useSyncExternalStore(noopSubscribe, prefersReducedMotion, () => true);
  const routeRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(() => data.steps[STILL_STEP]?.at ?? 0.3);
  const profile = usePreferences((s) => s.profile);
  const setProfile = usePreferences((s) => s.setProfile);

  // Walk the dot along the line. The path's own geometry gives the point and is
  // set directly on the SVG every frame; React re-renders only a few times a
  // second for the text. Paused when off screen.
  useEffect(() => {
    const path = routeRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;
    const length = path.getTotalLength();
    const place = (p: number) => {
      const pt = path.getPointAtLength(p * length);
      dot.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      path.style.strokeDashoffset = String(length * (1 - p));
    };
    path.style.strokeDasharray = String(length);
    if (still) {
      place(progress);
      return;
    }
    let frame = 0;
    let visible = true;
    const start = performance.now();
    let shown = -1;
    let rendered = 0;
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) frame = requestAnimationFrame(tick);
    });
    const tick = (now: number) => {
      if (!visible) return;
      const elapsed = (now - start) % (LOOP_MS + REST_MS);
      const p = Math.min(1, elapsed / LOOP_MS);
      place(p);
      // Re-render on each new step, and a few times a second for the distance and time left.
      const index = data.steps.findLastIndex((s) => s.at <= p + 0.002);
      if (index !== shown || now - rendered > 250) {
        shown = index;
        rendered = now;
        setProgress(p);
      }
      frame = requestAnimationFrame(tick);
    };
    if (frameRef.current) observer.observe(frameRef.current);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // progress is only read for the still picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, data]);

  const current = Math.max(0, data.steps.findLastIndex((s) => s.at <= progress + 0.002));
  const next = data.steps[Math.min(current + 1, data.steps.length - 1)];
  const arrived = progress >= 0.999;
  const step = { ...next, at: 0, distanceM: 0, segmentIds: [], notes: [] } as Step;
  const toNextM = Math.max(0, (next.at - progress) * data.distanceM);
  const leftS = (1 - progress) * data.durationS;

  return (
    <div className="pa-guide">
      <div ref={frameRef} className="pa-guide-stage" aria-hidden>
        <div className="pa-guide-glow" />
        <div className="pa-guide-phone">
          <svg viewBox={`0 0 ${data.width} ${data.height}`} className="pa-guide-map">
            <defs>
              <pattern id="pa-guide-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="9" cy="9" r="1.1" fill="var(--dome)" />
              </pattern>
            </defs>
            <rect width={data.width} height={data.height} fill="url(#pa-guide-grid)" />
            {data.alternatives.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--route-alt)" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <path d={data.route} fill="none" stroke="var(--route-casing)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
            <path d={data.route} fill="none" stroke="var(--line-subtle)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <path ref={routeRef} d={data.route} fill="none" stroke="var(--signal)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={data.origin[0]} cy={data.origin[1]} r={7} fill="var(--surface-raised)" stroke="var(--brand)" strokeWidth={3.5} />
            <circle cx={data.destination[0]} cy={data.destination[1]} r={8} fill="var(--brand)" stroke="var(--surface-raised)" strokeWidth={2.5} />
            <g ref={dotRef}>
              <circle r={16} fill="var(--winter)" opacity={0.18} className="pa-guide-halo" />
              <circle r={7.5} fill="var(--winter)" stroke="#fff" strokeWidth={3} />
            </g>
          </svg>
          <div className="pa-guide-banner">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={arrived ? "arrived" : current}
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <span className="pa-guide-icon">
                  <StepIcon step={{ kind: "walk", step, at: 0, along: 0 }} size={22} />
                </span>
                <span className="min-w-0">
                  {!arrived && <span className="pa-guide-distance tabular">{f.distance(toNextM)}</span>}
                  <span className="pa-guide-text">{arrived ? t("navigate.arrived") : stepText(step)}</span>
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="pa-guide-bar">
            <span className="pa-guide-eta tabular">{f.minutes(leftS)}</span>
            <span className="tabular text-xs text-ink-muted">{f.distance((1 - progress) * data.distanceM)}</span>
          </div>
        </div>
        <div className="pa-guide-chip is-transit">
          <TrainFront size={16} />
          {t("transit.suggest", { mode: "subway", line: "1", minutes: t("common.minutes", { value: 19 }) })}
        </div>
      </div>

      <p className="pa-guide-caption">{t("landing.guideCaption")}</p>

      <fieldset className="pa-guide-picks">
        <legend className="pa-field-label">{t("onboarding.profileTitle")}</legend>
        <div className="flex flex-wrap gap-2">
          {PICKS.map(({ profile: p, icon: Icon }) => (
            <button
              key={p}
              type="button"
              aria-pressed={profile === p}
              className={cn("pa-pick", profile === p && "is-on")}
              onClick={() => setProfile(p)}
            >
              <Icon aria-hidden size={18} />
              {t(`onboarding.profiles.${p}`)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-muted">{t("landing.profileSaved")}</p>
      </fieldset>
    </div>
  );
}
