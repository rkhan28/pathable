import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/features/layout/site-footer";
import { SiteHeader } from "@/features/layout/site-header";
import { SkipLink } from "@/features/layout/skip-link";

export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("common");
  return (
    <>
      <SkipLink>{t("skipToContent")}</SkipLink>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
