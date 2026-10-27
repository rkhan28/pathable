"use client";

import { useLocale, useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/segmented";
import { formatPercent } from "@/lib/format";
import { TEXT_SCALES, usePreferences, type ContrastPreference, type MotionPreference, type TextScale, type ThemePreference } from "./store";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="font-semibold" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Theme, contrast, text size and motion — applied live to the whole app. */
export function DisplaySettings({ showPreview = true }: { showPreview?: boolean }) {
  const t = useTranslations("settings.display");
  const tTheme = useTranslations("theme");
  const locale = useLocale();
  const display = usePreferences((s) => s.display);
  const setDisplay = usePreferences((s) => s.setDisplay);

  return (
    <div className="flex flex-col gap-5">
      <Row label={tTheme("label")}>
        <Segmented<ThemePreference>
          label={tTheme("label")}
          value={display.theme}
          onValueChange={(theme) => setDisplay({ theme })}
          options={[
            { value: "system", label: tTheme("system") },
            { value: "light", label: tTheme("light") },
            { value: "dark", label: tTheme("dark") },
          ]}
        />
      </Row>
      <Row label={t("contrast")}>
        <Segmented<ContrastPreference>
          label={t("contrast")}
          value={display.contrast}
          onValueChange={(contrast) => setDisplay({ contrast })}
          options={[
            { value: "system", label: t("contrastSystem") },
            { value: "standard", label: t("contrastStandard") },
            { value: "high", label: t("contrastHigh") },
          ]}
        />
      </Row>
      <Row label={t("textSize")}>
        <Segmented<string>
          label={t("textSize")}
          value={String(display.textScale)}
          onValueChange={(v) => setDisplay({ textScale: Number(v) as TextScale })}
          options={TEXT_SCALES.map((s) => ({ value: String(s), label: formatPercent(s, locale) }))}
        />
      </Row>
      <Row label={t("motion")}>
        <Segmented<MotionPreference>
          label={t("motion")}
          value={display.motion}
          onValueChange={(motion) => setDisplay({ motion })}
          options={[
            { value: "system", label: t("motionSystem") },
            { value: "reduce", label: t("motionReduce") },
          ]}
        />
      </Row>
      {showPreview ? (
        <p className="rounded-lg border border-border bg-surface-raised p-4 text-lg" aria-hidden="true">
          {t("preview")}
        </p>
      ) : null}
    </div>
  );
}
