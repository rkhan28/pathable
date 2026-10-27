"use client";

import { ChevronLeftIcon, ChevronRightIcon, Volume2Icon, VolumeXIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { LatLng, Route } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { Badge, Callout, ProgressBar } from "@/components/ui/feedback";
import { announce } from "@/features/a11y/announcer";
import { usePreferences } from "@/features/preferences/store";
import { ManeuverIcon } from "./route-details";
import { useSpeech } from "./use-speech";
import { useStepText } from "./use-step-text";

/**
 * Large-type, one-step-at-a-time directions. Steps advance manually: until
 * the routing service provides real geometry, auto-advancing on GPS would
 * imply a precision we don't have.
 */
export function GuidanceView({ route, onExit, onStep, sample }: { route: Route; onExit: () => void; onStep: (location: LatLng) => void; sample: boolean }) {
  const t = useTranslations("directions.guidance");
  const tDir = useTranslations("directions");
  const step = useStepText();
  const voice = usePreferences((s) => s.display.voiceGuidance);
  const setDisplay = usePreferences((s) => s.setDisplay);
  const speech = useSpeech();
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = route.steps[index];
  const total = route.steps.length;
  const text = step.instruction(current, { long: true });

  useEffect(() => {
    onStep(current.location);
    announce(`${tDir("step", { current: index + 1, total })}. ${text}`);
    if (voice) speech.speak(text);
    // Speak/announce once per step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const last = index === total - 1;

  return (
    <section aria-labelledby="guidance-title" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="guidance-title" ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
          {t("title")}
        </h2>
        <Button variant="secondary" onClick={onExit}>
          <XIcon aria-hidden="true" />
          {t("exit")}
        </Button>
      </div>

      {sample ? (
        <Callout tone="warning" role="note">
          {t("sampleWarning")}
        </Callout>
      ) : null}

      <div className="rounded-xl bg-primary p-6 text-primary-fg shadow-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold opacity-85">{tDir("step", { current: index + 1, total })}</p>
          <ManeuverIcon step={current} className="size-8" />
        </div>
        <p className="mt-3 text-[1.75rem] leading-tight font-semibold" aria-live="off">
          {text}
        </p>
        {current.notes.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {current.notes.map((n) => (
              <li key={n}>
                <Badge tone="neutral" className="border-transparent bg-primary-fg/15 text-primary-fg">
                  {step.note(n)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ProgressBar value={(index + 1) / total} label={tDir("title")} valueText={t("progress", { completed: index + 1, total })} />
      <p className="-mt-3 text-sm text-fg-muted">{t("progress", { completed: index + 1, total })}</p>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ChevronLeftIcon className="rtl:rotate-180" aria-hidden="true" />
          {t("previous")}
        </Button>
        <Button size="lg" disabled={last} onClick={() => setIndex((i) => i + 1)}>
          {t("next")}
          <ChevronRightIcon className="rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
      {last ? <p className="font-semibold text-verified">{t("arrived")}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {speech.supported ? (
          <>
            <Button variant="ghost" onClick={() => speech.speak(text)}>
              <Volume2Icon aria-hidden="true" />
              {t("repeat")}
            </Button>
            <Button variant="ghost" aria-pressed={voice} onClick={() => setDisplay({ voiceGuidance: !voice })}>
              {voice ? <Volume2Icon aria-hidden="true" /> : <VolumeXIcon aria-hidden="true" />}
              {voice ? t("voiceOn") : t("voiceOff")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-fg-muted">{t("voiceUnsupported")}</p>
        )}
      </div>
    </section>
  );
}
