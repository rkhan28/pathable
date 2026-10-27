"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getLocaleDefinition } from "@/i18n/locales";

/** Voice guidance via the Web Speech API, in the interface language when a voice exists. */
export function useSpeech() {
  const locale = useLocale();
  const supported = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = getLocaleDefinition(locale)?.speech ?? locale;
      utterance.lang = lang;
      const voice = synth.getVoices().find((v) => v.lang === lang) ?? synth.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      synth.speak(utterance);
    },
    [locale],
  );

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => stop, [stop]);
  return { supported, speak, stop };
}
