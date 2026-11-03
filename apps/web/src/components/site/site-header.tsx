import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { CommandPalette } from "@/components/palette/command-palette";

export function SiteHeader() {
  const t = useTranslations("nav");
  const links = [
    { href: "/#how-it-works", label: t("howItWorks") },
    { href: "/coverage", label: t("coverage") },
    { href: "/help", label: t("help") },
  ] as const;
  return (
    <header className="pa-site-header">
      <div className="pa-container flex h-(--header-height) items-center gap-6">
        <Link href="/" className="pa-logo-link" aria-label={t("home")}>
          <Wordmark />
        </Link>
        <nav aria-label={t("primary")} className="hidden md:block">
          <ul className="flex gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="pa-nav-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <CommandPalette withButton />
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
          <Link href="/navigate" className="pa-link-button hidden sm:inline-flex">
            {t("planner")}
          </Link>
          <MobileMenu links={[...links, { href: "/navigate", label: t("planner") }, { href: "/settings", label: t("settings") }]} />
        </div>
      </div>
    </header>
  );
}
