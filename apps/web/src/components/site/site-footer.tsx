import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("nav");
  const links = [
    ["/accessibility", t("accessibility")],
    ["/ai", t("ai")],
    ["/coverage", t("coverage")],
    ["/help", t("help")],
    ["/contact", t("contact")],
    ["/case-study", t("caseStudy")],
    ["/privacy", t("privacy")],
    ["/terms", t("terms")],
  ] as const;
  return (
    <footer className="pa-site-footer">
      <div className="pa-container py-12">
        <nav aria-label={t("footer")}>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="underline-offset-4 hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-8 max-w-(--measure) text-sm text-ink-muted">{t("attribution")}</p>
      </div>
    </footer>
  );
}
