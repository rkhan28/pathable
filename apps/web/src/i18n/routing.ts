import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, ENABLED_LOCALES } from "./locales";

export const routing = defineRouting({
  locales: ENABLED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
