"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PreferenceFields } from "@/components/settings/preference-fields";
import { HeroSvg } from "@/components/landing/hero-svg";
import { Link, useRouter } from "@/i18n/navigation";
import type { KnowledgeState } from "@/lib/api/contracts";
import type { HeroData } from "@/lib/hero-data";
import { segmentState } from "@/lib/scoring";
import { PROFILES, usePreferences, type Profile } from "@/stores/preferences";

const STEPS = ["profile", "limits", "avoid", "finish"] as const;
const CODE: Record<KnowledgeState, string> = { verified: "v", barrier: "b", unverified: "r", unknown: "u" };

export interface PreviewRoute {
  hero: HeroData;
  /** Evidence for each segment of the preview route, in order. */
  evidence: Parameters<typeof segmentState>[0]["evidence"][];
}

/**
 * Four skippable steps. A profile only pre-fills preferences. Every change
 * re-scores a real sample route on a dome-grid tile, so the effect is visible.
 */
export function Onboarding({ preview }: { preview: PreviewRoute }) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { profile, setProfile, preferences, notes, setNotes, completeOnboarding } = usePreferences();
  useEffect(() => headingRef.current?.focus(), [step]);

  // Live preview: re-score the sample route's evidence with the current preferences.
  const data: HeroData = useMemo(() => {
    const states = preview.evidence.map((ev, i) => CODE[segmentState({ id: String(i), evidence: ev }, preferences, [])]).join("");
    const r = preview.hero.routes[0];
    return { ...preview.hero, routes: [r], profiles: { ...preview.hero.profiles, wheelchair: { order: [r.id], states: { [r.id]: states }, reason: null } } };
  }, [preview, preferences]);

  const finish = () => {
    completeOnboarding();
    router.push("/navigate");
  };
  const name = STEPS[step];

  return (
    <div className="pa-container grid max-w-5xl gap-10 py-10 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between">
          <p className="tabular text-sm text-ink-muted">{t("onboarding.progress", { current: step + 1, total: STEPS.length })}</p>
          <button type="button" className="pa-text-link" onClick={finish}>
            {t("onboarding.skipAll")}
          </button>
        </div>
        <div className="pa-progress" aria-hidden>
          <div className="pa-progress-bar" style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
        </div>

        {name === "profile" && (
          <fieldset className="border-0 p-0">
            <legend>
              <h1 ref={headingRef} tabIndex={-1} className="pa-step-title">{t("onboarding.profileTitle")}</h1>
            </legend>
            <p className="mt-2 text-ink-muted">{t("onboarding.profileHint")}</p>
            <div className="mt-6 grid gap-2">
              {PROFILES.map((p: Profile) => (
                <label key={p} className="pa-choice">
                  <input type="radio" name="profile" value={p} checked={profile === p} onChange={() => setProfile(p)} className="pa-route-radio" />
                  <span>{t(`onboarding.profiles.${p}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {name === "limits" && (
          <section aria-labelledby="ob-limits">
            <h1 id="ob-limits" ref={headingRef} tabIndex={-1} className="pa-step-title mb-6">{t("onboarding.limitsTitle")}</h1>
            <PreferenceFields part="limits" />
          </section>
        )}
        {name === "avoid" && (
          <section aria-labelledby="ob-avoid">
            <h1 id="ob-avoid" ref={headingRef} tabIndex={-1} className="pa-step-title mb-6">{t("onboarding.avoidTitle")}</h1>
            <PreferenceFields part="avoid" />
            <div className="mt-8">
              <label htmlFor="notes" className="pa-field-label">{t("onboarding.notesLabel")}</label>
              <p id="notes-hint" className="text-sm text-ink-muted">{t("onboarding.notesHint")}</p>
              <textarea id="notes" rows={3} className="pa-input mt-2" aria-describedby="notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>
        )}
        {name === "finish" && (
          <section aria-labelledby="ob-finish" className="pa-finish domes">
            <h1 id="ob-finish" ref={headingRef} tabIndex={-1} className="pa-step-title">{t("onboarding.finishTitle")}</h1>
            <p className="mt-3">{t("onboarding.finishBody")}</p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {step > 0 && (
            <button type="button" className="pa-link-button" onClick={() => setStep((s) => s - 1)}>
              {t("common.back")}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="pa-link-button is-primary" onClick={() => setStep((s) => s + 1)}>
              {t("common.next")}
            </button>
          ) : (
            <button type="button" className="pa-link-button is-primary" onClick={finish}>
              {t("onboarding.finishCta")}
            </button>
          )}
          {step === 0 && (
            <Link href="/settings" className="pa-text-link self-center">
              {t("nav.settings")}
            </Link>
          )}
        </div>
      </div>

      <figure className="pa-onboarding-preview">
        <div className="pa-preview-tile">
          <HeroSvg data={data} profile="wheelchair" title={t("onboarding.preview")} />
        </div>
        <figcaption className="mt-2 text-sm text-ink-muted">{t("onboarding.preview")}</figcaption>
      </figure>
    </div>
  );
}
