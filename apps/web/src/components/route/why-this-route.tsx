"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { Reason } from "@/lib/api/contracts";

/** The explanation is built from the reason codes the ranking produced, never from prose. */
export function WhyThisRoute({ reasons, rank, total }: { reasons: Reason[]; rank: number; total: number }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button type="button" className="pa-disclosure" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {t("route.why")}
        <ChevronDown aria-hidden size={18} className={open ? "rotate-180" : ""} />
      </button>
      <div id={id} hidden={!open} className="pa-why">
        <p>{t("route.whyIntro", { rank, total })}</p>
        <ul className="mt-2 list-disc ps-5">
          {reasons.map((r) => (
            <li key={r.code}>{t(`reasons.${r.code}`, { value: r.value ?? 0 })}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
