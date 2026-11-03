"use client";

import { ChevronDown, Eye, PersonStanding } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { PROFILES, usePreferences, type Profile } from "@/stores/preferences";

/**
 * "How do you get around?" as one native select, so it works the same with a
 * screen reader, a switch device or a phone's picker wheel. Choosing a profile
 * refills the preferences; changing any preference afterwards makes it Custom.
 */
export function ProfilePicker({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations();
  const id = useId();
  const profile = usePreferences((s) => s.profile);
  const setProfile = usePreferences((s) => s.setProfile);
  const Icon = profile === "blind_low_vision" ? Eye : PersonStanding;
  return (
    <div className={cn(compact ? "pa-profile is-compact" : "pa-profile", className)}>
      <label htmlFor={id} className={compact ? "sr-only" : "pa-field-label"}>
        {t("onboarding.profileTitle")}
      </label>
      <span className="pa-profile-field">
        {compact && <Icon aria-hidden size={16} className="pa-profile-icon" />}
        <select
          id={id}
          className="pa-profile-select"
          value={profile ?? ""}
          onChange={(e) => e.target.value && setProfile(e.target.value as Profile)}
        >
          {profile === null && <option value="">{t("planner.chooseProfile")}</option>}
          {PROFILES.map((p) => (
            <option key={p} value={p}>
              {p === "custom" ? t("planner.customProfile") : t(`onboarding.profiles.${p}`)}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} className="pa-profile-chevron" />
      </span>
    </div>
  );
}
