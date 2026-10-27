import { getTranslations } from "next-intl/server";
import { Logo } from "@/features/brand/logo";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tBrand = await getTranslations("brand");

  const groups = [
    {
      title: tNav("product"),
      links: [
        { href: "/navigate", label: tNav("navigate") },
        { href: "/report", label: tNav("report") },
        { href: "/settings", label: tNav("settings") },
        { href: "/coverage", label: tNav("coverage") },
      ],
    },
    {
      title: tNav("trust"),
      links: [
        { href: "/accessibility", label: tNav("accessibility") },
        { href: "/ai", label: tNav("ai") },
        { href: "/privacy", label: tNav("privacy") },
        { href: "/terms", label: tNav("terms") },
      ],
    },
    {
      title: tNav("support"),
      links: [
        { href: "/help", label: tNav("help") },
        { href: "/contact", label: tNav("contact") },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border bg-bg-subtle">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs font-display text-2xl leading-tight text-fg">{tBrand("statement")}</p>
          <p className="max-w-sm text-sm text-fg-muted">{tBrand("statementNote")}</p>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="mb-3 text-sm font-semibold text-fg">{g.title}</h2>
            <ul className="flex flex-col gap-1">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-10 items-center text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            {t("mission")} <strong className="font-semibold text-fg">{t("status")}</strong>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{t("mapData")}</span>
            <span>{t("builtIn")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
