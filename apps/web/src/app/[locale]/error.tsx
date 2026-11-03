"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <main id="main" className="pa-container py-20">
      <div className="pa-empty-state">
        <h1 className="text-xl">{t("errors.pageError")}</h1>
        <p className="mt-3 max-w-(--measure)">{t("errors.pageErrorBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="pa-link-button is-primary" onClick={reset}>{t("common.retry")}</button>
          <Link href="/navigate" className="pa-link-button">{t("nav.planner")}</Link>
        </div>
      </div>
    </main>
  );
}
