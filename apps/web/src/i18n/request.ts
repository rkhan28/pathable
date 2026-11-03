import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async () => {
  const requested = await rootParams.locale();
  if (!hasLocale(routing.locales, requested)) notFound();
  return {
    locale: requested,
    messages: (await import(`../messages/${requested}.json`)).default,
    timeZone: "America/Toronto",
  };
});
