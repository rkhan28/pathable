"use client";

import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { spring } from "@/lib/motion";
import { prefersReducedMotion } from "@/lib/motion";

export type Snap = "collapsed" | "half" | "full";
const ORDER: Snap[] = ["collapsed", "half", "full"];
const COLLAPSED_PX = 136;
const TOP_GAP_PX = 72;
const RUBBER = 0.25;
const VELOCITY_PROJECTION_S = 0.18;

function heights(viewport: number): Record<Snap, number> {
  return { collapsed: COLLAPSED_PX, half: Math.round(viewport * 0.5), full: viewport - TOP_GAP_PX };
}

/**
 * Non-modal bottom sheet for the mobile planner. The map stays usable behind
 * it. Drag snaps by projected velocity with rubber-banding at the ends; the
 * handle is a real button, so arrow keys resize it and dragging is optional.
 * `onVisibleHeight` lets the map pad its camera by the sheet's height.
 */
export function BottomSheet({
  children,
  snap,
  onSnapChange,
  onVisibleHeight,
  label,
}: {
  children: ReactNode;
  snap: Snap;
  onSnapChange: (s: Snap) => void;
  onVisibleHeight: (px: number) => void;
  label: string;
}) {
  const t = useTranslations("planner");
  const [viewport, setViewport] = useState(800);
  const h = heights(viewport);
  // y is the sheet's offset from fully open: 0 = full, larger = lower.
  const y = useMotionValue(h.full - h[snap]);
  const drag = useRef<{ startY: number; startOffset: number; lastY: number; lastT: number; velocity: number } | null>(null);

  useEffect(() => {
    const update = () => setViewport(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const settle = useCallback(
    (target: Snap) => {
      const offset = h.full - h[target];
      if (prefersReducedMotion()) y.set(offset);
      else animate(y, offset, { ...spring.sheet, velocity: drag.current?.velocity ?? 0 });
      onSnapChange(target);
    },
    [h, y, onSnapChange],
  );

  useEffect(() => {
    settle(snap);
    // Re-snap when the viewport changes or the parent changes snap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, viewport]);

  useMotionValueEvent(y, "change", (v) => onVisibleHeight(Math.max(0, h.full - v)));

  const onPointerDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startOffset: y.get(), lastY: e.clientY, lastT: performance.now(), velocity: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    d.velocity = ((e.clientY - d.lastY) / Math.max(1, now - d.lastT)) * 1000;
    d.lastY = e.clientY;
    d.lastT = now;
    const raw = d.startOffset + (e.clientY - d.startY);
    const max = h.full - h.collapsed;
    // Rubber-band past either end.
    const banded = raw < 0 ? raw * RUBBER : raw > max ? max + (raw - max) * RUBBER : raw;
    y.set(banded);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    const projected = y.get() + d.velocity * VELOCITY_PROJECTION_S;
    const visible = h.full - projected;
    const nearest = ORDER.reduce((best, s) => (Math.abs(h[s] - visible) < Math.abs(h[best] - visible) ? s : best), ORDER[0]);
    settle(nearest);
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ORDER.indexOf(snap);
    const next =
      e.key === "ArrowUp" ? ORDER[Math.min(i + 1, 2)] : e.key === "ArrowDown" ? ORDER[Math.max(i - 1, 0)] : e.key === "Home" ? "full" : e.key === "End" ? "collapsed" : null;
    if (next) {
      e.preventDefault();
      settle(next);
    }
  };

  const position = { collapsed: t("sheetCollapsed"), half: t("sheetHalf"), full: t("sheetFull") }[snap];

  return (
    <motion.section aria-label={label} className="pa-sheet" style={{ y, height: h.full }}>
      <div className="pa-sheet-grip" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <button
          type="button"
          className="pa-sheet-handle"
          aria-label={t("sheetHandle", { position })}
          onKeyDown={onKeyDown}
          onClick={() => settle(snap === "full" ? "collapsed" : ORDER[ORDER.indexOf(snap) + 1])}
        >
          <span aria-hidden className="pa-sheet-bar" />
        </button>
      </div>
      <div className="pa-sheet-body" style={{ maxHeight: h[snap] - 40 }}>
        {children}
      </div>
    </motion.section>
  );
}
