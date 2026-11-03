"use client";

import { Download, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AlertDialog } from "radix-ui";
import { useRef } from "react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SliderRow, SwitchRow } from "@/components/ui/field-controls";
import { announce } from "@/lib/announce";
import { usePreferences } from "@/stores/preferences";
import { useReports } from "@/stores/reports";
import { useSettings, type ContrastSetting, type MotionSetting, type ThemeSetting } from "@/stores/settings";
import { useTrip } from "@/stores/trip";
import { MyReports } from "@/components/report/my-reports";
import { ProfilePicker } from "./profile-picker";
import { PreferenceFields } from "./preference-fields";

export function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const settings = useSettings();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: { theme: settings.theme, contrast: settings.contrast, motion: settings.motion, textScale: settings.textScale, voice: settings.voice, locale },
      preferences: usePreferences.getState().preferences,
      profile: usePreferences.getState().profile,
      notes: usePreferences.getState().notes,
      reports: useReports.getState().reports,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "pathable-data.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAll = () => {
    usePreferences.getState().reset();
    useReports.getState().clear();
    useTrip.getState().clear();
    settings.set({ theme: "system", contrast: "system", motion: "system", textScale: 1, voice: false });
    for (const store of [localStorage, sessionStorage]) {
      Object.keys(store).filter((k) => k.startsWith("pathable:")).forEach((k) => store.removeItem(k));
    }
    toast(t("deleted"));
    announce(t("deleted"));
  };

  return (
    <div className="pa-container max-w-3xl py-10">
      <h1 className="text-xl">{t("title")}</h1>

      <section aria-labelledby="appearance" className="pa-settings-group">
        <h2 id="appearance" className="text-lg">{t("appearance")}</h2>
        <SegmentedControl<ThemeSetting>
          legend={t("theme")}
          value={settings.theme}
          onChange={(theme) => settings.set({ theme })}
          options={[
            { value: "system", label: t("themeSystem") },
            { value: "light", label: t("themeLight") },
            { value: "dark", label: t("themeDark") },
          ]}
        />
        <SegmentedControl<ContrastSetting>
          legend={t("contrast")}
          value={settings.contrast}
          onChange={(contrast) => settings.set({ contrast })}
          options={[
            { value: "system", label: t("contrastSystem") },
            { value: "normal", label: t("contrastNormal") },
            { value: "more", label: t("contrastMore") },
          ]}
        />
        <SliderRow
          label={t("textSize")}
          value={settings.textScale}
          min={1}
          max={1.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(textScale) => settings.set({ textScale })}
        />
        <SegmentedControl<MotionSetting>
          legend={t("motion")}
          value={settings.motion}
          onChange={(motion) => settings.set({ motion })}
          options={[
            { value: "system", label: t("motionSystem") },
            { value: "reduced", label: t("motionReduced") },
            { value: "full", label: t("motionFull") },
          ]}
        />
        <SwitchRow label={t("voice")} checked={settings.voice} onChange={(voice) => settings.set({ voice })} />
        <div className="flex items-center justify-between gap-4">
          <span className="font-bold">{t("language")}</span>
          <LanguageSwitcher />
        </div>
      </section>

      <section id="mobility" aria-labelledby="mobility-title" className="pa-settings-group">
        <h2 id="mobility-title" className="text-lg">{t("mobility")}</h2>
        <ProfilePicker />
        <PreferenceFields />
      </section>

      <MyReports />

      <section aria-labelledby="data-title" className="pa-settings-group">
        <h2 id="data-title" className="text-lg">{t("data")}</h2>
        <p className="max-w-(--measure) text-ink-muted">{t("dataBody")}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="pa-link-button" onClick={exportData}>
            <Download aria-hidden size={18} />
            {t("export")}
          </button>
          <AlertDialog.Root>
            <AlertDialog.Trigger className="pa-link-button is-danger">
              <Trash2 aria-hidden size={18} />
              {t("deleteAll")}
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="pa-overlay" />
              <AlertDialog.Content className="pa-dialog" onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}>
                <AlertDialog.Title className="text-lg">{t("deleteConfirmTitle")}</AlertDialog.Title>
                <AlertDialog.Description className="mt-3">{t("deleteConfirmBody")}</AlertDialog.Description>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <AlertDialog.Cancel ref={cancelRef} className="pa-link-button">
                    {tc("cancel")}
                  </AlertDialog.Cancel>
                  <AlertDialog.Action className="pa-link-button is-danger" onClick={deleteAll}>
                    {t("deleteAll")}
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </section>
    </div>
  );
}
