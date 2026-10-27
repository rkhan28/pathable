/**
 * Locale registry.
 *
 * PathAble is architected for 12 languages, but a language is only *enabled*
 * (routable, selectable) once its translation file is complete and has been
 * reviewed by a fluent speaker. `status` documents where each one stands.
 *
 * - `code`    BCP 47 tag used for Intl formatting and the <html lang> attribute.
 * - `prefix`  URL segment shown to users (/en, /fr, ...).
 * - `dir`     Text direction. Arabic and Urdu are RTL and the whole UI uses
 *             logical CSS properties (ms-/me-/ps-/pe-/start/end) so it mirrors.
 * - `speech`  Preferred SpeechSynthesis voice language for voice guidance.
 */
export type LocaleStatus = "complete" | "in-progress" | "planned";

export interface LocaleDefinition {
  code: string;
  prefix: string;
  nativeName: string;
  englishName: string;
  dir: "ltr" | "rtl";
  status: LocaleStatus;
  speech: string;
}

export const LOCALE_REGISTRY = [
  { code: "en-CA", prefix: "en", nativeName: "English", englishName: "English (Canada)", dir: "ltr", status: "complete", speech: "en-CA" },
  { code: "fr-CA", prefix: "fr", nativeName: "Français", englishName: "French (Canada)", dir: "ltr", status: "complete", speech: "fr-CA" },
  { code: "es", prefix: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", status: "planned", speech: "es-ES" },
  { code: "ar", prefix: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", status: "planned", speech: "ar" },
  { code: "zh-Hans", prefix: "zh-hans", nativeName: "简体中文", englishName: "Chinese (Simplified)", dir: "ltr", status: "planned", speech: "zh-CN" },
  { code: "zh-Hant", prefix: "zh-hant", nativeName: "繁體中文", englishName: "Chinese (Traditional)", dir: "ltr", status: "planned", speech: "zh-HK" },
  { code: "hi", prefix: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr", status: "planned", speech: "hi-IN" },
  { code: "ur", prefix: "ur", nativeName: "اردو", englishName: "Urdu", dir: "rtl", status: "planned", speech: "ur-PK" },
  { code: "bn", prefix: "bn", nativeName: "বাংলা", englishName: "Bengali", dir: "ltr", status: "planned", speech: "bn-IN" },
  { code: "pa", prefix: "pa", nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi", dir: "ltr", status: "planned", speech: "pa-IN" },
  { code: "ta", prefix: "ta", nativeName: "தமிழ்", englishName: "Tamil", dir: "ltr", status: "planned", speech: "ta-IN" },
  { code: "pt", prefix: "pt", nativeName: "Português", englishName: "Portuguese", dir: "ltr", status: "planned", speech: "pt-BR" },
] as const satisfies readonly LocaleDefinition[];

export type RegisteredLocale = (typeof LOCALE_REGISTRY)[number];

/** Only complete translations are routable. Order matters: first is the default. */
export const ENABLED_LOCALES = ["en-CA", "fr-CA"] as const;
export type AppLocale = (typeof ENABLED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en-CA";

export function getLocaleDefinition(code: string): LocaleDefinition | undefined {
  return LOCALE_REGISTRY.find((l) => l.code === code);
}

export function getDirection(code: string): "ltr" | "rtl" {
  return getLocaleDefinition(code)?.dir ?? "ltr";
}

export const LOCALE_PREFIXES = Object.fromEntries(
  ENABLED_LOCALES.map((code) => [code, `/${getLocaleDefinition(code)!.prefix}`]),
) as Record<AppLocale, string>;
