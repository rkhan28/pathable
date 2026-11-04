"use client";

import { ArrowRight, TrainFront } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StepIcon } from "@/components/navigate/maneuver-icon";
import { useStepText } from "@/components/route/route-details";
import { Link } from "@/i18n/navigation";
import type { Step } from "@/lib/api/contracts";
import type { GuideData } from "@/lib/guide-data";
import { useRouteFormat } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";

const noopSubscribe = () => () => {};
/** Notes worth a line on the small phone; "surface: no data" is on nearly every step and would only be noise here. */
const SHOWN_NOTES = new Set(["kerbs_lowered", "kerbs_unknown", "aps_present", "aps_unknown", "aps_absent", "kerb_raised", "slope_steep", "steps"]);
/** A chapter's walk finishes a little before its end, so the phone rests on the step while you read. */
const SETTLE = 0.8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The landing's walk-through: a phone that stays put while you scroll, and a
 * real route that advances with the page. Each chapter stops at a real step
 * of the York University to Finch West route and says, in a line, what the
 * guidance is showing there.
 *
 * Scrolling is the only thing that moves it, so nothing plays on its own.
 * With reduced motion the phone jumps from step to step instead of gliding.
 * The phone is decorative for assistive technology; the chapters are the
 * same story in text.
 */
export function GuideStory({ data }: { data: GuideData }) {
  const t = useTranslations();
  const f = useRouteFormat();
  const stepText = useStepText();
  const still = useSyncExternalStore(noopSubscribe, prefersReducedMotion, () => true);
  const listRef = useRef<HTMLOListElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const [view, setView] = useState({ chapter: 0, p: 0 });
  const ends = data.chapters.map((c) => data.steps[c.step].at);

  // Turn the scroll position into a point along the route. The line and dot are
  // set directly on the SVG; React re-renders only when the text would change.
  useEffect(() => {
    const list = listRef.current;
    const path = routeRef.current;
    const dot = dotRef.current;
    if (!list || !path || !dot) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    const wide = window.matchMedia("(min-width: 64rem)");
    const n = ends.length;
    let frame = 0;
    let shown = { chapter: -1, p: -1 };
    const update = () => {
      frame = 0;
      // Measured from the first chapter to the last, so the list's own padding does not count.
      const top = list.firstElementChild!.getBoundingClientRect().top;
      const bottom = list.lastElementChild!.getBoundingClientRect().bottom;
      // On a phone the picture fills the screen and the chapters are spacers beneath it,
      // so a chapter counts from the moment it enters at the bottom.
      const line = window.innerHeight * (wide.matches ? 0.5 : 1);
      const t = clamp((line - top) / (bottom - top), 0, 0.99999) * n;
      const chapter = Math.floor(t);
      const within = still ? 1 : clamp((t - chapter) / SETTLE, 0, 1);
      const start = chapter === 0 ? 0 : ends[chapter - 1];
      const p = start + (ends[chapter] - start) * within;
      const pt = path.getPointAtLength(p * length);
      dot.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      path.style.strokeDashoffset = String(length * (1 - p));
      if (chapter !== shown.chapter || Math.abs(p - shown.p) > 0.004) {
        shown = { chapter, p };
        setView(shown);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // ends is derived from data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, data]);

  const chapter = data.chapters[view.chapter];
  const raw = data.steps[chapter.step];
  const step = { ...raw, at: 0, distanceM: 0, segmentIds: [] } as Step;
  const arrived = chapter.id === "arrive" && view.p >= 0.999;
  const toNextM = Math.max(0, (raw.at - view.p) * data.distanceM);
  const notes = raw.notes.filter((n) => SHOWN_NOTES.has(n)).slice(0, 2);
  const transitLine = data.transit
    ? t("transit.suggest", { mode: data.transit.mode, line: data.transit.line, minutes: t("common.minutes", { value: data.transit.savesMin }) })
    : null;
  const body = (id: string) => (id === "transit" ? t("landing.story.transitBody", { line: transitLine ?? "" }) : t(`landing.story.${id}Body`));
  const num = (i: number) => String(i + 1).padStart(2, "0");
  const cta = (className: string) => (
    <Link href="/navigate" className={`pa-link-button is-primary ${className}`}>
      {t("landing.cta")}
      <ArrowRight aria-hidden size={18} className="rtl:rotate-180" />
    </Link>
  );

  return (
    <>
      <div className="pa-story-grid">
        <div className="pa-story-stage">
          <div className="pa-story-phone" aria-hidden>
            <svg viewBox={`0 0 ${data.width} ${data.height}`} className="pa-story-map">
              <defs>
                <pattern id="pa-story-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                  <circle cx="9" cy="9" r="1.1" fill="var(--dome)" />
                </pattern>
              </defs>
              <rect width={data.width} height={data.height} fill="url(#pa-story-grid)" />
              {data.alternatives.map((d, i) => (
                <path key={i} d={d} fill="none" stroke="var(--route-alt)" strokeOpacity={0.4} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              <path d={data.route} fill="none" stroke="var(--route-casing)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
              <path d={data.route} fill="none" stroke="var(--line-subtle)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <path ref={routeRef} d={data.route} fill="none" stroke="var(--signal)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={data.origin[0]} cy={data.origin[1]} r={7} fill="var(--surface-raised)" stroke="var(--brand)" strokeWidth={3.5} />
              <circle cx={data.destination[0]} cy={data.destination[1]} r={8} fill="var(--brand)" stroke="var(--surface-raised)" strokeWidth={2.5} />
              <g ref={dotRef} transform={`translate(${data.origin[0]} ${data.origin[1]})`}>
                <circle r={15} fill="var(--winter)" opacity={0.16} />
                <circle r={7.5} fill="var(--winter)" stroke="#fff" strokeWidth={3} />
              </g>
            </svg>

            <div className="pa-story-banner">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={arrived ? "arrived" : view.chapter}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: still ? 0 : 0.18, ease: "easeOut" }}
                >
                  <span className="pa-story-icon">
                    <StepIcon step={{ kind: "walk", step, at: 0, along: 0 }} size={22} />
                  </span>
                  <span className="min-w-0">
                    {!arrived && <span className="pa-story-distance tabular">{f.distance(toNextM)}</span>}
                    <span className="pa-story-text">{arrived ? t("navigate.arrived") : stepText(step)}</span>
                  </span>
                </motion.div>
              </AnimatePresence>
              {notes.length > 0 && !arrived && (
                <div className="pa-story-notes">
                  {notes.map((n) => (
                    <span key={n} className={n.endsWith("_unknown") ? "is-unknown" : undefined}>
                      {t(`steps.notes.${n}`)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {chapter.id === "transit" && transitLine && (
                <motion.div
                  className="pa-story-chip"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: still ? 0 : 0.22, ease: "easeOut" }}
                >
                  <TrainFront size={16} />
                  {transitLine}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pa-story-bar">
              <span className="pa-story-eta tabular">{f.minutes((1 - view.p) * data.durationS)}</span>
              <span className="tabular text-xs text-ink-muted">{f.distance((1 - view.p) * data.distanceM)}</span>
            </div>
          </div>
          {/* On a phone the chapters are read here, under the picture; the list below keeps them for screen readers. */}
          <div className="pa-story-caption" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view.chapter}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: still ? 0 : 0.2, ease: "easeOut" }}
              >
                <span className="pa-story-num tabular">{num(view.chapter)}</span>
                <p className="pa-story-title">{t(`landing.story.${chapter.id}Title`)}</p>
                <p className="pa-story-body">{body(chapter.id)}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <ol ref={listRef} className="pa-story-chapters">
          {data.chapters.map((c, i) => (
            <li key={c.id} className="pa-story-chapter" data-active={i === view.chapter || undefined}>
              <div className="pa-story-card">
                <span className="pa-story-num tabular">{num(i)}</span>
                <h3 className="pa-story-title">{t(`landing.story.${c.id}Title`)}</h3>
                <p className="pa-story-body">{body(c.id)}</p>
                {c.id === "arrive" && cta("pa-story-cta mt-5")}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="pa-story-after">{cta("")}</div>
    </>
  );
}
