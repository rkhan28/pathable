import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { atkinson, atkinsonMono, instrumentSerif } from "../fonts";
import { Providers } from "../providers";
import "../globals.css";
import { CommandPaletteHost } from "@/features/commands/command-palette-host";
import { DISPLAY_BOOT_SCRIPT } from "@/features/preferences/boot-script";
import { getDirection, getLocaleDefinition } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { template: t("titleTemplate"), default: t("defaultTitle") },
    description: t("description"),
    applicationName: "PathAble",
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${getLocaleDefinition(l)!.prefix}`])),
    },
    openGraph: {
      type: "website",
      siteName: "PathAble",
      locale: locale.replace("-", "_"),
      title: t("defaultTitle"),
      description: t("description"),
    },
    icons: { icon: "/brand/pathable-app-icon.svg", apple: "/brand/pathable-app-icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never disable pinch-zoom (WCAG 1.4.4): no maximumScale / userScalable here.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${atkinson.variable} ${atkinsonMono.variable} ${instrumentSerif.variable}`}
      // The boot script adjusts class/data attributes before hydration (theme, contrast, text size).
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers>
            {children}
            <CommandPaletteHost />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
