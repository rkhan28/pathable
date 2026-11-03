/**
 * Language registry. A language is `enabled` only once its messages are fully
 * translated and reviewed by a fluent speaker; src/i18n/i18n.test.ts enforces
 * that the enabled list, the routing config and the message files agree.
 */
export interface LocaleInfo {
  code: string;
  /** Name in the language itself, shown in the language menu. */
  endonym: string;
  dir: "ltr" | "rtl";
  enabled: boolean;
}

export const LOCALES = [
  { code: "en-CA", endonym: "English (Canada)", dir: "ltr", enabled: true },
  { code: "fr-CA", endonym: "Français (Canada)", dir: "ltr", enabled: true },
  { code: "es", endonym: "Español", dir: "ltr", enabled: false },
  { code: "ar", endonym: "العربية", dir: "rtl", enabled: false },
  { code: "zh-Hans", endonym: "简体中文", dir: "ltr", enabled: false },
  { code: "zh-Hant", endonym: "繁體中文", dir: "ltr", enabled: false },
  { code: "hi", endonym: "हिन्दी", dir: "ltr", enabled: false },
  { code: "ur", endonym: "اردو", dir: "rtl", enabled: false },
  { code: "bn", endonym: "বাংলা", dir: "ltr", enabled: false },
  { code: "pa", endonym: "ਪੰਜਾਬੀ", dir: "ltr", enabled: false },
  { code: "ta", endonym: "தமிழ்", dir: "ltr", enabled: false },
  { code: "pt", endonym: "Português", dir: "ltr", enabled: false },
] as const satisfies readonly LocaleInfo[];

export type LocaleCode = (typeof LOCALES)[number]["code"];
export const ENABLED_LOCALES = LOCALES.filter((l) => l.enabled).map((l) => l.code);
export const DEFAULT_LOCALE = "en-CA";

export function localeInfo(code: string): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
