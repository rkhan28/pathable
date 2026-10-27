"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Detection } from "@/api/contracts";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";
import { cn } from "@/lib/utils";

export type DetectionDecision = "keep" | "reject" | undefined;

/**
 * Draws bounding boxes exactly as returned by the analysis API — positions,
 * labels and confidences come only from `detections`. With no detections it
 * renders nothing; it never invents placeholder boxes for effect.
 * Decorative for assistive tech: the same detections are listed as controls.
 */
export function DetectionOverlay({ detections, decisions, activeId }: { detections: Detection[]; decisions: Record<string, DetectionDecision>; activeId?: string | null }) {
  const t = useTranslations("hazards.types");
  const reduced = usePrefersReducedMotion();
  if (detections.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="detection-overlay">
      {detections.map((d, i) => {
        const decision = decisions[d.id];
        return (
          <motion.div
            key={d.id}
            data-testid="detection-box"
            initial={reduced ? false : { opacity: 0, scale: 1.08 }}
            animate={{ opacity: decision === "reject" ? 0.35 : 1, scale: 1 }}
            transition={{ delay: reduced ? 0 : 0.12 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute rounded-md border-[3px]",
              decision === "reject" ? "border-dashed border-white/80" : "border-unverified shadow-[0_0_0_2px_rgb(0_0_0/0.35)]",
              decision === "keep" && "border-verified",
              activeId === d.id && "ring-4 ring-white",
            )}
            style={{ left: `${d.box.x * 100}%`, top: `${d.box.y * 100}%`, width: `${d.box.width * 100}%`, height: `${d.box.height * 100}%` }}
          >
            <span className="absolute -top-7 start-0 rounded-md bg-fg px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-fg-inverse">
              {i + 1}. {t(d.label)} {Math.round(d.confidence * 100)}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
