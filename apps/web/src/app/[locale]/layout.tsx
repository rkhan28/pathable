import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { BootScript } from "@/components/site/boot-script";
import { LiveRegions } from "@/components/site/live-regions";
import { ENABLED_LOCALES, localeInfo } from "@/i18n/locales";
import { introScript } from "@/components/landing/intro-script";
import { bootScript } from "@/stores/settings";
import { atkinson, atkinsonMono } from "../fonts";
import { Providers } from "../providers";
import "../globals.css";

export function generateStaticParams() {
  return ENABLED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(site),
    title: { default: t("title"), template: t("titleTemplate", { page: "%s" }) },
    description: t("description"),
    icons: { icon: "/brand/pathable-app-icon.svg" },
    alternates: { languages: Object.fromEntries(ENABLED_LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1311" },
  ],
};

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html
      lang={locale}
      dir={localeInfo(locale).dir}
      className={`${atkinson.variable} ${atkinsonMono.variable}`}
      data-theme="light"
      data-contrast="normal"
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme, contrast, motion and text size before first paint, and decides
            whether the landing's intro plays. */}
        <BootScript code={bootScript + introScript} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <LiveRegions />
        <Toaster position="bottom-center" toastOptions={{ className: "pa-toast" }} />
      </body>
    </html>
  );
}
