"use client";

import { useReducedMotion } from "motion/react";
import { usePreferences } from "@/features/preferences/store";

/** True when either the OS or the in-app setting asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const system = useReducedMotion();
  const setting = usePreferences((s) => s.display.motion);
  return setting === "reduce" || Boolean(system);
}
