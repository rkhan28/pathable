"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { PREFERENCE_FLAGS } from "@/api/contracts";
import { Label, Slider, Switch, Textarea } from "@/components/ui/form-controls";
import { ProfilePicker } from "./profile-picker";
import { usePreferences } from "./store";

/**
 * Mobility preferences, applied immediately (no save button): routes re-rank
 * as soon as a value changes, which makes the effect of each setting visible.
 */
export function PreferencesForm({ showProfile = true, showNotes = true }: { showProfile?: boolean; showNotes?: boolean }) {
  const t = useTranslations("preferences");
  const tCommon = useTranslations("common");
  const id = useId();
  const mobility = usePreferences((s) => s.mobility);
  const update = usePreferences((s) => s.updateMobility);
  const setProfile = usePreferences((s) => s.setProfile);
  const notes = usePreferences((s) => s.personalNotes);
  const setNotes = usePreferences((s) => s.setPersonalNotes);

  return (
    <div className="flex flex-col gap-8">
      {showProfile ? <ProfilePicker legend={t("profile")} hint={t("profileHint")} value={mobility.profile} onChange={setProfile} /> : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor={`${id}-slope-toggle`}>{t("maxSlope")}</Label>
            <p className="text-sm text-fg-muted" id={`${id}-slope-hint`}>
              {t("maxSlopeHint")}
            </p>
          </div>
          <Switch
            id={`${id}-slope-toggle`}
            checked={mobility.maxSlopePercent !== null}
            onCheckedChange={(on) => update({ maxSlopePercent: on ? 6 : null })}
            aria-describedby={`${id}-slope-hint`}
          />
        </div>
        {mobility.maxSlopePercent !== null ? (
          <div className="flex items-center gap-4">
            <Slider
              thumbLabel={t("maxSlope")}
              min={2}
              max={12}
              step={0.5}
              value={[mobility.maxSlopePercent]}
              onValueChange={([v]) => update({ maxSlopePercent: v })}
              aria-valuetext={t("maxSlopeValue", { value: mobility.maxSlopePercent })}
            />
            <output className="w-16 shrink-0 text-end font-mono text-lg font-semibold tabular" aria-hidden="true">
              {t("maxSlopeValue", { value: mobility.maxSlopePercent })}
            </output>
          </div>
        ) : (
          <p className="text-sm font-semibold text-fg-muted">{t("noLimit")}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor={`${id}-width-toggle`}>{t("minWidth")}</Label>
            <p className="text-sm text-fg-muted" id={`${id}-width-hint`}>
              {t("minWidthHint")}
            </p>
          </div>
          <Switch id={`${id}-width-toggle`} checked={mobility.minWidthCm !== null} onCheckedChange={(on) => update({ minWidthCm: on ? 90 : null })} aria-describedby={`${id}-width-hint`} />
        </div>
        {mobility.minWidthCm !== null ? (
          <div className="flex items-center gap-4">
            <Slider
              thumbLabel={t("minWidth")}
              min={60}
              max={150}
              step={5}
              value={[mobility.minWidthCm]}
              onValueChange={([v]) => update({ minWidthCm: v })}
              aria-valuetext={t("minWidthValue", { value: mobility.minWidthCm })}
            />
            <output className="w-20 shrink-0 text-end font-mono text-lg font-semibold tabular" aria-hidden="true">
              {t("minWidthValue", { value: mobility.minWidthCm })}
            </output>
          </div>
        ) : (
          <p className="text-sm font-semibold text-fg-muted">{t("noLimit")}</p>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface-raised">
        {PREFERENCE_FLAGS.map((flag) => (
          <li key={flag} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Label htmlFor={`${id}-${flag}`} className="cursor-pointer">
                {t(`flags.${flag}.label`)}
              </Label>
              <p id={`${id}-${flag}-hint`} className="text-sm text-fg-muted">
                {t(`flags.${flag}.hint`)}
              </p>
            </div>
            <Switch id={`${id}-${flag}`} checked={mobility[flag]} onCheckedChange={(v) => update({ [flag]: v })} aria-describedby={`${id}-${flag}-hint`} />
          </li>
        ))}
      </ul>

      {showNotes ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-notes`}>
            {t("notes")} <span className="font-normal text-fg-muted">({tCommon("optional")})</span>
          </Label>
          <p id={`${id}-notes-hint`} className="-mt-1 text-sm text-fg-muted">
            {t("notesHint")}
          </p>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} aria-describedby={`${id}-notes-hint`} maxLength={1000} />
        </div>
      ) : null}
    </div>
  );
}
