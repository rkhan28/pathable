"use client";

import { useTranslations } from "next-intl";
import { SliderRow, SwitchRow } from "@/components/ui/field-controls";
import type { Preferences } from "@/lib/api/contracts";
import { usePreferences } from "@/stores/preferences";

const AVOID: (keyof Preferences)[] = [
  "avoidStairs",
  "avoidMissingRamps",
  "avoidDamagedSurfaces",
  "avoidReportedObstacles",
  "avoidNarrow",
  "preferVerified",
  "preferShorter",
];

/** The mobility preferences, shared by onboarding and settings. */
export function PreferenceFields({ part = "all" }: { part?: "all" | "limits" | "avoid" }) {
  const t = useTranslations();
  const prefs = usePreferences((s) => s.preferences);
  const set = usePreferences((s) => s.setPreference);
  return (
    <div className="grid gap-6">
      {part !== "avoid" && (
        <>
          <SliderRow
            label={t("preferences.maxRunningSlopePct")}
            hint={t("preferences.maxRunningSlopeHint")}
            value={prefs.maxRunningSlopePct}
            min={2}
            max={12}
            step={0.1}
            format={(v) => t("common.percent", { value: v })}
            onChange={(v) => set("maxRunningSlopePct", Math.round(v * 10) / 10)}
          />
          <SliderRow
            label={t("preferences.minWidthM")}
            hint={t("preferences.minWidthHint")}
            value={prefs.minWidthM}
            min={0.6}
            max={2.5}
            step={0.05}
            format={(v) => t("common.metres", { value: v })}
            onChange={(v) => set("minWidthM", Math.round(v * 100) / 100)}
          />
        </>
      )}
      {part !== "limits" && (
        <div className="grid gap-1">
          {AVOID.map((key) => (
            <SwitchRow key={key} label={t(`preferences.${key}`)} checked={Boolean(prefs[key])} onChange={(v) => set(key, v as never)} />
          ))}
        </div>
      )}
    </div>
  );
}
