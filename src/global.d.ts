import type messages from "./messages/en-CA.json";
import type { routing } from "./i18n/routing";

/**
 * Type-safe translations: every t("key") call is checked against the English
 * catalogue at compile time, so a missing or misspelled key fails `npm run typecheck`.
 * French parity is enforced separately by src/messages/messages.test.ts.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
