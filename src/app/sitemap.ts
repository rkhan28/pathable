import type { MetadataRoute } from "next";
import { getLocaleDefinition } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

const PATHS = ["", "/navigate", "/report", "/coverage", "/accessibility", "/help", "/contact", "/privacy", "/terms", "/ai"];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const prefix = (l: string) => `/${getLocaleDefinition(l)!.prefix}`;
  return PATHS.map((path) => ({
    url: `${site}${prefix(routing.defaultLocale)}${path}`,
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${site}${prefix(l)}${path}`])) },
  }));
}
