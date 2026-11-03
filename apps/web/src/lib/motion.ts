/**
 * Motion tokens. The only place durations, springs and easings are defined.
 * What may animate: state changes the person caused, the route line, the map
 * camera, the sheet, and one load moment per page. Body text and numbers never.
 */
export const spring = {
  ui: { type: "spring", stiffness: 380, damping: 32 },
  sheet: { type: "spring", stiffness: 260, damping: 30 },
} as const;

export const duration = { press: 0.12, state: 0.2, panel: 0.32, route: 0.56 } as const;

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Map camera duration scales with distance travelled, clamped to 700–1100 ms. */
export function cameraDuration(distanceKm: number): number {
  return Math.round(Math.min(1100, Math.max(700, 700 + distanceKm * 40)));
}

/** True when the OS asks for reduced motion and the person has not overridden it in settings. */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  const setting = document.documentElement.dataset.motion;
  if (setting === "reduced") return true;
  if (setting === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Transition for reduced motion: instant, or a short opacity-only change. */
export const reducedTransition = { duration: duration.press, ease: "linear" } as const;
