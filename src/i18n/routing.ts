import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, ENABLED_LOCALES, LOCALE_PREFIXES } from "./locales";

export const routing = defineRouting({
  locales: ENABLED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Users see /en and /fr; internally the [locale] segment is the full
  // BCP 47 tag (en-CA / fr-CA) so Intl formats Canadian dates and numbers.
  localePrefix: { mode: "always", prefixes: LOCALE_PREFIXES },
  localeCookie: { name: "PATHABLE_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
