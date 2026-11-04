"use client";

import { Accessibility, Eye, Footprints, PersonStanding } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { usePreferences, type Profile } from "@/stores/preferences";

const PICKS: { profile: Profile; icon: typeof Accessibility }[] = [
  { profile: "manual_wheelchair", icon: Accessibility },
  { profile: "walker", icon: PersonStanding },
  { profile: "cane", icon: Footprints },
  { profile: "blind_low_vision", icon: Eye },
];

/** "How do you get around?" as four buttons. Saves to this device and carries into the planner. */
export function ProfilePicks() {
  const t = useTranslations();
  const profile = usePreferences((s) => s.profile);
  const setProfile = usePreferences((s) => s.setProfile);
  return (
    <fieldset className="pa-picks">
      <legend className="pa-field-label">{t("onboarding.profileTitle")}</legend>
      <div className="flex flex-wrap gap-2">
        {PICKS.map(({ profile: p, icon: Icon }) => (
          <button key={p} type="button" aria-pressed={profile === p} className={cn("pa-pick", profile === p && "is-on")} onClick={() => setProfile(p)}>
            <Icon aria-hidden size={18} />
            {t(`onboarding.profiles.${p}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{t("landing.profileSaved")}</p>
    </fieldset>
  );
}
