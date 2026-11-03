"use client";

import { ChevronLeft, ChevronRight, Square, Volume2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type { Route } from "@/lib/api/contracts";
import { announce } from "@/lib/announce";
import { useRouteFormat } from "@/lib/format";
import { useSettings } from "@/stores/settings";
import { useStepText } from "./route-details";

/**
 * Large-text, manually stepped guidance with optional voice in the interface
 * language. Mounted only while open, so every session starts at step 1.
 */
export function Guidance({ route, open, onOpenChange, onStep }: { route: Route; open: boolean; onOpenChange: (o: boolean) => void; onStep?: (index: number) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const f = useRouteFormat();
  const stepText = useStepText();
  const voice = useSettings((s) => s.voice);
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = route.steps[index];
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const text = [stepText(step), ...step.notes.map((n) => t(`steps.notes.${n}`))].join(". ");

  const speak = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  const stop = () => window.speechSynthesis?.cancel();

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    onStep?.(index);
    if (voice) speak();
    else announce(text);
    return () => window.speechSynthesis?.cancel();
    // Re-run when the step changes or guidance opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content className="pa-guidance" aria-describedby="guidance-notes">
          <div className="flex items-center justify-between">
            <Dialog.Title className="tabular text-md">{t("guidance.step", { current: index + 1, total: route.steps.length })}</Dialog.Title>
            <Dialog.Close className="pa-icon-button" aria-label={t("guidance.exit")}>
              <X aria-hidden size={24} />
            </Dialog.Close>
          </div>
          <div className="flex flex-1 flex-col justify-center py-8">
            <h2 ref={headingRef} tabIndex={-1} className="pa-guidance-instruction outline-none">
              {stepText(step)}
            </h2>
            {step.distanceM > 0 && <p className="tabular mt-3 text-lg">{f.distance(step.distanceM)}</p>}
            <ul id="guidance-notes" className="mt-4 grid gap-2 text-md">
              {step.notes.map((n) => (
                <li key={n}>{t(`steps.notes.${n}`)}</li>
              ))}
            </ul>
          </div>
          <div className="pa-guidance-controls">
            <button type="button" className="pa-guidance-button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft aria-hidden size={24} className="rtl:rotate-180" />
              {t("guidance.previous")}
            </button>
            {canSpeak ? (
              <button type="button" className="pa-guidance-button" onClick={speaking ? () => { stop(); setSpeaking(false); } : speak}>
                {speaking ? <Square aria-hidden size={22} /> : <Volume2 aria-hidden size={22} />}
                {speaking ? t("guidance.stop") : t("guidance.read")}
              </button>
            ) : (
              <p className="text-sm text-ink-muted">{t("guidance.voiceUnavailable")}</p>
            )}
            <button type="button" className="pa-guidance-button is-primary" disabled={index === route.steps.length - 1} onClick={() => setIndex((i) => i + 1)}>
              {t("guidance.next")}
              <ChevronRight aria-hidden size={24} className="rtl:rotate-180" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
