import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  // An explicit override (e.g. getTranslations({ locale })) wins; otherwise
  // read the [locale] root segment. Unknown values 404 instead of falling back
  // silently — with Cache Components, dynamicParams=false is not available.
  const requested = override ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, requested)) notFound();

  return {
    locale: requested,
    timeZone: "America/Toronto",
    messages: (await import(`../messages/${requested}.json`)).default,
    formats: {
      dateTime: {
        short: { dateStyle: "medium" },
        stamp: { dateStyle: "medium", timeStyle: "short" },
      },
    },
  };
});
