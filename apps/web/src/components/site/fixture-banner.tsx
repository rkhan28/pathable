"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

/**
 * Shown whenever routes come from development fixtures. It can be collapsed to
 * a short label but never dismissed: the label is part of every fixture view.
 */
export function FixtureBanner({ generatedAt, className }: { generatedAt?: string; className?: string }) {
  const t = useTranslations("fixture");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const id = useId();
  const date = generatedAt ? format.dateTime(new Date(generatedAt), { dateStyle: "medium" }) : "";
  return (
    <section aria-label={t("label")} className={`pa-fixture-banner ${className ?? ""}`}>
      <button
        type="button"
        className="pa-fixture-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <FlaskConical aria-hidden size={18} />
        <span className="font-bold">{t("bannerShort")}</span>
        <span className="sr-only">{open ? t("collapse") : t("expand")}</span>
        <ChevronDown aria-hidden size={18} className={open ? "rotate-180" : ""} />
      </button>
      <p id={id} hidden={!open} className="pa-fixture-detail">
        {t("banner", { date })}
      </p>
    </section>
  );
}
