import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/features/layout/site-header";
import { SkipLink } from "@/features/layout/skip-link";

/** Product surfaces: compact, non-sticky header so the map and forms get the room. */
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("common");
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink>{t("skipToContent")}</SkipLink>
      <SiteHeader variant="app" />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </div>
  );
}
