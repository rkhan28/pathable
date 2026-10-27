"use client";

import { motion, type MotionProps } from "motion/react";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";

/**
 * Adapted from Magic UI "Blur Fade" (MIT, https://magicui.design).
 * Changes: renders children immediately with no transform/blur when reduced
 * motion is requested (OS or in-app), removed AnimatePresence/in-view logic —
 * PathAble uses it only for the single hero load sequence.
 */
export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.5,
  offset = 10,
  ...props
}: MotionProps & { children: React.ReactNode; className?: string; delay?: number; duration?: number; offset?: number }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: offset, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: 0.05 + delay, duration, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
