"use client";

import { Footprints, TrainFront } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { NetworkCaption } from "@/lib/hero-network";
import { useRouteFormat } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { inkOn } from "@/components/navigate/maneuver-icon";
import type { Network, Palette, Size } from "./renderer";

type Send = (message: { type: "resize"; size: Size } | { type: "palette"; palette: Palette } | { type: "play" } | { type: "pause" }) => void;

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  return {
    dark,
    verified: v("--state-verified"),
    barrier: v("--state-barrier"),
    unverified: v("--state-unverified"),
    unknown: v("--state-unknown"),
    signal: v("--signal"),
  };
}

/**
 * The landing hero's picture: North York's real sidewalk network, alive.
 * Pulses move along the streets, coloured by what is known about each one,
 * and the planner's routes for York University to Finch West draw themselves
 * in turn, the subway option among them.
 *
 * The drawing happens in a worker on an OffscreenCanvas where the browser
 * allows it, so the page's own thread stays free; elsewhere it runs here.
 * The tilt, drift and pointer parallax are CSS transforms, which the
 * compositor handles. It stops when off screen or in a background tab, and
 * under reduced motion it is one still frame.
 */
export function HeroNetwork({ aspect, captions }: { aspect: number; captions: NetworkCaption[] }) {
  const t = useTranslations();
  const f = useRouteFormat();
  const rootRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const plane = planeRef.current;
    if (!root || !plane) return;
    const reduced = prefersReducedMotion();
    // A fresh canvas each time: a canvas handed to a worker cannot be handed over again.
    const canvas = document.createElement("canvas");
    canvas.className = "pa-net-canvas";
    plane.appendChild(canvas);
    const size = (): Size => ({ width: plane.clientWidth, height: plane.clientHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    const url = new URL("/hero-network.json", window.location.href).href;
    let visible = false;
    let send: Send = () => {};
    let worker: Worker | null = null;
    let local: Network | null = null;
    let disposed = false;
    const onMessage = (m: { type: string; index?: number }) => {
      if (m.type === "ready") setReady(true);
      if (m.type === "show" && typeof m.index === "number") setShow(m.index);
    };

    if ("transferControlToOffscreen" in canvas && typeof Worker !== "undefined") {
      const offscreen = canvas.transferControlToOffscreen();
      worker = new Worker(new URL("./network.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e) => onMessage(e.data);
      worker.postMessage({ type: "init", canvas: offscreen, url, palette: readPalette(), size: size(), reduced, playing: visible }, [offscreen]);
      send = (m) => worker?.postMessage(m);
    } else {
      // No OffscreenCanvas: the same drawing code on this thread, loaded only now.
      const queued: Parameters<Send>[0][] = [];
      send = (m) => queued.push(m);
      void Promise.all([import("./renderer"), fetch(url).then((r) => r.json())]).then(([{ createNetwork }, data]) => {
        if (disposed) return;
        local = createNetwork(canvas, data, { palette: readPalette(), size: size(), reduced, onReady: () => onMessage({ type: "ready" }), onShow: (index) => onMessage({ type: "show", index }) });
        send = (m) => {
          if (m.type === "resize") local?.resize(m.size);
          else if (m.type === "palette") local?.setPalette(m.palette);
          else if (m.type === "play") local?.play();
          else local?.pause();
        };
        if (visible) local.play();
        queued.filter((m) => m.type === "resize" || m.type === "palette").forEach((m) => send(m));
      });
    }

    // Play only while on screen and the tab is in front.
    const sync = () => send({ type: visible && !document.hidden ? "play" : "pause" });
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", sync);

    let resizeFrame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => send({ type: "resize", size: size() }));
    });
    ro.observe(plane);

    // Theme changes: the page's own toggle sets data-theme; the system setting changes the media query.
    const repaint = () => requestAnimationFrame(() => send({ type: "palette", palette: readPalette() }));
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", repaint);

    // The plane leans a little toward the pointer. Only CSS variables change, once per frame at most.
    let pointerFrame = 0;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onPointer = (e: PointerEvent) => {
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        root.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    if (fine && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      disposed = true;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      scheme.removeEventListener("change", repaint);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(pointerFrame);
      worker?.terminate();
      local?.destroy();
      canvas.remove();
    };
  }, []);

  const caption = captions[show] ?? captions[0];
  const states = ["verified", "barrier", "unverified", "unknown"] as const;

  return (
    <div ref={rootRef} className="pa-net" data-ready={ready || undefined} aria-hidden>
      <div className="pa-net-stage">
        <div className="pa-net-drift">
          <div ref={planeRef} className="pa-net-plane" style={{ aspectRatio: aspect }} />
        </div>
      </div>

      <div className="pa-net-card is-route">
        <span className="pa-net-trip">{t("landing.network.trip")}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={caption.id}
            className="pa-net-route"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {caption.ride ? (
              <span className="pa-net-badge" style={{ background: caption.ride.color, color: inkOn(caption.ride.color) }}>
                <TrainFront size={14} />
                {t("landing.network.line", { mode: caption.ride.mode, line: caption.ride.line })}
              </span>
            ) : (
              <span className="pa-net-badge is-walk">
                <Footprints size={14} />
                {caption.label}
              </span>
            )}
            <span className="pa-net-time tabular">{f.minutes(caption.durationS)}</span>
            <span className="pa-net-meta tabular">{caption.ride ? t("transit.stepFree.yes") : f.distance(caption.distanceM)}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pa-net-card is-legend">
        {states.map((s) => (
          <span key={s} className="pa-net-key">
            <i className={`is-${s}`} />
            {t(`states.${s}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
