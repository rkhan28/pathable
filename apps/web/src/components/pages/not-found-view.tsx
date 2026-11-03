import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function NotFoundView() {
  const t = await getTranslations("notFound");
  return (
    <section className="pa-container py-20">
      <div className="pa-empty-state domes">
        <h1 className="text-xl">{t("title")}</h1>
        <p className="mt-3 max-w-(--measure)">{t("body")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/navigate" className="pa-link-button is-primary">{t("planner")}</Link>
          <Link href="/help" className="pa-link-button">{t("help")}</Link>
        </div>
      </div>
    </section>
  );
}
