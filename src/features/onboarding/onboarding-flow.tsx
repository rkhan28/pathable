"use client";

import { ArrowLeftIcon, CircleCheckIcon, LockIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { announce } from "@/features/a11y/announcer";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";
import { DisplaySettings } from "@/features/preferences/display-settings";
import { PreferencesForm } from "@/features/preferences/preferences-form";
import { ProfilePicker } from "@/features/preferences/profile-picker";
import { usePreferences } from "@/features/preferences/store";
import { useRouter } from "@/i18n/navigation";

const STEPS = ["profile", "preferences", "display", "done"] as const;
type Step = (typeof STEPS)[number];

/**
 * Four short steps; every one can be skipped. Focus moves to each step's
 * heading so screen-reader users hear where they are.
 */
export function OnboardingFlow() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tProfiles = useTranslations("profiles");
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const mobility = usePreferences((s) => s.mobility);
  const setProfile = usePreferences((s) => s.setProfile);
  const setOnboarding = usePreferences((s) => s.setOnboarding);
  const [index, setIndex] = useState(0);
  const step: Step = STEPS[index];
  const shouldFocus = useRef(false);
  // Callback ref: with AnimatePresence the new heading mounts after the old step animates out.
  const headingRef = (el: HTMLHeadingElement | null) => {
    if (el && shouldFocus.current) {
      shouldFocus.current = false;
      el.focus();
    }
  };
  const goTo = (i: number) => {
    shouldFocus.current = true;
    setIndex(i);
    announce(t("progress", { current: i + 1, total: STEPS.length }));
  };

  const next = () => goTo(Math.min(STEPS.length - 1, index + 1));
  const finish = () => {
    setOnboarding("completed");
    router.push("/navigate");
  };
  const skip = () => {
    setOnboarding("skipped");
    toast(t("skippedToast"));
    router.push("/navigate");
  };

  useEffect(() => {
    if (step === "done") setOnboarding("completed");
  }, [step, setOnboarding]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-fg-muted">{t("progress", { current: index + 1, total: STEPS.length })}</p>
          {step !== "done" ? (
            <Button variant="ghost" size="sm" onClick={skip}>
              {t("skipAll")}
            </Button>
          ) : null}
        </div>
        <ProgressBar value={(index + 1) / STEPS.length} label={t("title")} valueText={t("progress", { current: index + 1, total: STEPS.length })} />
      </div>

      {index === 0 ? (
        <div>
          <h1 className="font-display text-headline">{t("title")}</h1>
          <p className="mt-3 text-lg text-fg-muted">{t("intro")}</p>
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          aria-labelledby="onboarding-step-title"
          className="flex flex-col gap-6"
        >
          <div>
            <h2 id="onboarding-step-title" ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
              {t(`steps.${step}.title`)}
            </h2>
            <p className="mt-2 text-fg-muted">{t(`steps.${step}.body`)}</p>
          </div>

          {step === "profile" ? <ProfilePicker legend={t("steps.profile.title")} hideLegend value={mobility.profile} onChange={setProfile} /> : null}
          {step === "preferences" ? (
            <>
              <p className="-mt-3 text-sm font-semibold text-accent">
                {tProfiles(`${mobility.profile}.name`)}: {tProfiles("startingPoint")}
              </p>
              <PreferencesForm showProfile={false} />
            </>
          ) : null}
          {step === "display" ? <DisplaySettings /> : null}
          {step === "done" ? (
            <div className="flex flex-col items-start gap-4 rounded-xl bg-verified-soft p-6">
              <CircleCheckIcon className="size-10 text-verified" aria-hidden="true" />
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                <LockIcon className="size-4" aria-hidden="true" />
                {t("privacy")}
              </p>
            </div>
          ) : null}
        </motion.section>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        {index > 0 && step !== "done" ? (
          <Button variant="ghost" onClick={() => goTo(index - 1)}>
            <ArrowLeftIcon className="rtl:rotate-180" aria-hidden="true" />
            {tCommon("back")}
          </Button>
        ) : (
          <span />
        )}
        {step === "done" ? (
          <Button size="lg" onClick={finish}>
            {t("finish")}
          </Button>
        ) : (
          <Button size="lg" onClick={next}>
            {tCommon("continue")}
          </Button>
        )}
      </div>
    </div>
  );
}
