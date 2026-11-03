"use client";

import { Check, ChevronLeft, ChevronRight, LocateFixed, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LonLat } from "@/lib/api/contracts";
import { announce } from "@/lib/announce";
import { useRouteFormat } from "@/lib/format";
import { type Journey, type JourneyStep, OFF_ROUTE_FIXES, OFF_ROUTE_M, progress } from "@/lib/journey";
import { duration, prefersReducedMotion, spring } from "@/lib/motion";
import { useStepText } from "@/components/route/route-details";
import { useSettings } from "@/stores/settings";
import { StepIcon, inkOn } from "./maneuver-icon";
import { navCamera } from "./nav-camera";
import { useFix } from "./use-fix";

/** After a new route, give the person time to join it before asking for another. */
const REROUTE_COOLDOWN_MS = 20_000;
/** Say the next instruction again when it gets this close. */
const SAY_AGAIN_AT_M = 40;

/**
 * Live guidance, in the manner of a car or phone navigator: one large
 * instruction at the top that changes as you go, the time and distance left at
 * the bottom, and the map following you in between.
 */
export function Navigation({
  journey,
  onExit,
  onReroute,
  rerouting = false,
}: {
  journey: Journey;
  onExit: () => void;
  /** Called when the person has left the route; the parent may hand back a new journey. */
  onReroute?: (from: LonLat) => void;
  rerouting?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const format = useFormatter();
  const f = useRouteFormat();
  const stepText = useStepText();
  const voiceSetting = useSettings((s) => s.voice);
  const [voice, setVoice] = useState(voiceSetting);
  const { source, reason, fix, playing, setPlaying, seek, tickMs } = useFix(journey);
  const camera = useSyncExternalStore(navCamera.subscribe, navCamera.get, navCamera.get);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const offCount = useRef(0);
  const reroutedAt = useRef(0);
  const along = fix?.along ?? 0;
  const p = progress(journey, along);
  const instruction = (step: JourneyStep): { title: string; detail: string | null } => {
    if (step.kind === "walk") return { title: stepText(step.step), detail: null };
    const time = format.dateTime(new Date(step.ride.departAt), { hour: "numeric", minute: "2-digit" });
    if (step.kind === "board")
      return {
        title: t("navigate.board", { mode: step.ride.mode, line: step.ride.line }),
        detail: t("navigate.boardDetail", { stop: step.ride.from.name, time }),
      };
    return { title: t("navigate.alight", { stop: step.ride.to.name }), detail: t("navigate.stops", { count: step.ride.stops }) };
  };
  const now = instruction(p.next);
  // Before the last ride ends you cannot arrive earlier than the schedule says, however fast you walk to the stop.
  const lastRide = journey.rides.at(-1);
  const estimate = fix ? fix.at + p.remainingS * 1000 : 0;
  const arrival = journey.scheduledArrival && lastRide && along < lastRide.endM ? Math.max(estimate, Date.parse(journey.scheduledArrival)) : estimate;
  const minutesLeft = fix ? Math.max(0, (arrival - fix.at) / 1000) : p.remainingS;
  const arriveAt = fix ? format.dateTime(new Date(arrival), { hour: "numeric", minute: "2-digit" }) : "";

  // Hand the position to the map; snap to the line when close, so the dot does not wander off the drawn route.
  useEffect(() => {
    if (!fix) return;
    const position = fix.offRouteM < 20 ? fix.snapped : fix.position;
    navCamera.set({ user: { position, bearing: fix.heading ?? 0, durationMs: tickMs } });
  }, [fix, tickMs]);

  useEffect(() => () => navCamera.reset(), []);

  // Leaving the route on foot asks for a new one; one stray fix is not enough.
  useEffect(() => {
    if (source !== "live" || !fix || p.ride || rerouting) return;
    const off = fix.offRouteM > OFF_ROUTE_M && fix.accuracyM < 60;
    offCount.current = off ? offCount.current + 1 : 0;
    if (offCount.current >= OFF_ROUTE_FIXES && fix.at - reroutedAt.current > REROUTE_COOLDOWN_MS) {
      offCount.current = 0;
      reroutedAt.current = fix.at;
      onReroute?.(fix.position);
    }
  }, [fix, source, p.ride, rerouting, onReroute]);

  // Speak and announce each new instruction, and once more as it gets close.
  const said = useRef<{ index: number; near: boolean }>({ index: -1, near: false });
  useEffect(() => {
    if (!fix || source === "locating") return;
    const text = p.arrived ? t("navigate.arrived") : [now.title, now.detail].filter(Boolean).join(". ");
    const fresh = said.current.index !== p.nextIndex || (p.arrived && !said.current.near);
    const closing = !fresh && !said.current.near && p.toNextM <= SAY_AGAIN_AT_M && !p.ride;
    if (!fresh && !closing) return;
    said.current = { index: p.nextIndex, near: closing || p.arrived || p.toNextM <= SAY_AGAIN_AT_M };
    const spoken = closing ? t("navigate.soon", { instruction: now.title }) : text;
    announce(spoken);
    if (voice && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = locale;
      window.speechSynthesis.speak(u);
    }
    // Speak on step changes and thresholds only, not on every fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.nextIndex, p.arrived, p.toNextM <= SAY_AGAIN_AT_M, source === "locating"]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (p.arrived && source === "preview") setPlaying(false);
  }, [p.arrived, source, setPlaying]);

  // Escape ends guidance, as it closes any other full-screen view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const big = p.ride ? f.minutes(p.remainingS - (journey.totalM - p.ride.endM)) : f.distance(p.toNextM);
  const heading = source === "locating" ? t("navigate.locating") : p.arrived ? t("navigate.arrived") : now.title;
  const reduced = prefersReducedMotion();
  const enter = reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 };
  const ride = p.next.kind !== "walk" ? p.next.ride : null;
  // Preview only: jump to the next step, or back to the one before the current step.
  const stepTo = (dir: 1 | -1) => {
    const i = dir === 1 ? p.nextIndex : Math.max(0, p.nextIndex - 2);
    seek(Math.min(journey.totalM, journey.steps[i].along + 5));
  };

  return (
    <div className="pa-nav" role="region" aria-label={t("navigate.region")}>
      {/* One steady heading for screen readers; the sliding banner below is the visual copy. */}
      <div className="sr-only">
        <h2 ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
        {!p.arrived && source !== "locating" && <p>{[big, now.detail].filter(Boolean).join(". ")}</p>}
      </div>
      <div className="pa-nav-top">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            aria-hidden
            key={p.arrived ? "arrived" : p.nextIndex}
            className={p.arrived ? "pa-nav-banner is-arrived" : "pa-nav-banner"}
            initial={enter}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={reduced ? { duration: duration.press } : spring.ui}
          >
            <span
              className="pa-nav-icon"
              style={ride?.color ? { background: ride.color, color: inkOn(ride.color) } : undefined}
            >
              {p.arrived ? <Check aria-hidden size={34} /> : <StepIcon step={p.next} size={34} />}
            </span>
            <div className="min-w-0 flex-1">
              {!p.arrived && source !== "locating" && <p className="pa-nav-distance tabular">{big}</p>}
              <p className="pa-nav-instruction">{heading}</p>
              {!p.arrived && now.detail && source !== "locating" && <p className="pa-nav-detail">{now.detail}</p>}
            </div>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {(source === "preview" || rerouting) && (
            <motion.p
              className="pa-nav-chip"
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.state }}
            >
              {rerouting ? t("navigate.rerouting") : t(`navigate.preview.${reason ?? "far"}`)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!camera.follow && (
          <motion.button
            type="button"
            className="pa-nav-recenter"
            onClick={() => navCamera.set({ follow: true })}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.ui}
          >
            <LocateFixed aria-hidden size={20} />
            {t("navigate.recenter")}
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        className="pa-nav-bar"
        initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduced ? { duration: duration.press } : spring.sheet}
      >
        <div className="pa-nav-summary">
          {p.arrived ? (
            <p className="pa-nav-eta">{t("navigate.done")}</p>
          ) : (
            <>
              <p className="pa-nav-eta tabular">{f.minutes(minutesLeft)}</p>
              <p className="pa-nav-meta tabular">
                <span>{f.distance(p.remainingM)}</span>
                <span>{t("navigate.arriveAt", { time: arriveAt })}</span>
              </p>
            </>
          )}
        </div>
        <div className="pa-nav-controls">
          {source === "preview" && !p.arrived && (
            <div className="pa-nav-preview" role="group" aria-label={t("navigate.previewControls")}>
              <button type="button" className="pa-nav-button" onClick={() => stepTo(-1)} aria-label={t("navigate.previousStep")}>
                <ChevronLeft aria-hidden size={22} className="rtl:rotate-180" />
              </button>
              <button type="button" className="pa-nav-button" onClick={() => setPlaying(!playing)} aria-label={playing ? t("navigate.pause") : t("navigate.play")}>
                {playing ? <Pause aria-hidden size={22} /> : <Play aria-hidden size={22} />}
              </button>
              <button type="button" className="pa-nav-button" onClick={() => stepTo(1)} aria-label={t("navigate.nextStep")}>
                <ChevronRight aria-hidden size={22} className="rtl:rotate-180" />
              </button>
            </div>
          )}
          {"speechSynthesis" in globalThis && (
            <button
              type="button"
              className="pa-nav-button"
              aria-pressed={voice}
              onClick={() => {
                if (voice) window.speechSynthesis.cancel();
                setVoice(!voice);
              }}
              aria-label={t("navigate.voice")}
            >
              {voice ? <Volume2 aria-hidden size={22} /> : <VolumeX aria-hidden size={22} />}
            </button>
          )}
        </div>
        <button type="button" className={p.arrived ? "pa-nav-exit is-done" : "pa-nav-exit"} onClick={onExit}>
          {p.arrived ? <Check aria-hidden size={20} /> : <X aria-hidden size={20} />}
          {p.arrived ? t("navigate.finish") : t("navigate.exit")}
        </button>
      </motion.div>
    </div>
  );
}
