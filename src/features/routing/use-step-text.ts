"use client";

import { useLocale, useTranslations } from "next-intl";
import type { RouteStep } from "@/api/contracts";
import { formatDistance, formatDistanceLong } from "@/lib/format";

/**
 * Directions are rendered client-side from structured steps, so every language
 * (and voice guidance) gets grammatical sentences instead of server English.
 */
export function useStepText() {
  const t = useTranslations("directions");
  const locale = useLocale();

  const maneuver = (step: RouteStep) => {
    const { type, modifier } = step.maneuver;
    const key = type === "turn" ? (`turn_${modifier ?? "straight"}` as const) : type;
    return t(`maneuver.${key}`);
  };

  return {
    maneuver,
    instruction(step: RouteStep, opts: { long?: boolean } = {}) {
      const m = maneuver(step);
      const base = step.streetName ? t("onto", { maneuver: m, street: step.streetName }) : m;
      if (step.maneuver.type === "arrive" || step.distanceMeters <= 0) return base;
      const distance = opts.long ? formatDistanceLong(step.distanceMeters, locale) : formatDistance(step.distanceMeters, locale);
      return t("forDistance", { instruction: base, distance });
    },
    note: (n: RouteStep["notes"][number]) => t(`notes.${n}`),
  };
}
