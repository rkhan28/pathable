import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

/** Compact header for app surfaces that are not the full-screen planner. */
export function AppHeader() {
  const t = useTranslations("nav");
  return (
    <header className="pa-site-header">
      <div className="pa-container flex h-(--header-height) items-center gap-4">
        <Link href="/" className="pa-logo-link" aria-label={t("home")}>
          <Wordmark />
        </Link>
        <nav aria-label={t("primary")} className="ms-auto flex items-center gap-2">
          <Link href="/navigate" className="pa-nav-link">{t("planner")}</Link>
          <Link href="/settings" className="pa-nav-link max-sm:hidden">{t("settings")}</Link>
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
