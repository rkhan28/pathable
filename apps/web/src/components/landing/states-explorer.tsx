"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { KnowledgeState } from "@/lib/api/contracts";
import { StateIcon, StateSwatch, STATE_TEXT_CLASS } from "@/components/route/state-icon";

const ORDER: KnowledgeState[] = ["verified", "barrier", "unverified", "unknown"];

/**
 * Interactive legend: pick a state to see how it is drawn and how much of the
 * demo corridor it covers. Shares are from docs/DATA_REPORT.md (baseline profile).
 */
export function StatesExplorer({ shares }: { shares: Record<KnowledgeState, number> }) {
  const t = useTranslations("states");
  const [state, setState] = useState<KnowledgeState>("unknown");
  return (
    <div className="pa-states">
      <SegmentedControl
        legend={t("legend")}
        value={state}
        onChange={setState}
        options={ORDER.map((s) => ({ value: s, label: t(s) }))}
      />
      <div className="pa-states-strip" aria-hidden>
        {ORDER.map((s) => (
          <div key={s} className={s === state ? "pa-states-cell is-active" : "pa-states-cell"}>
            <StateSwatch state={s} width={200} />
          </div>
        ))}
      </div>
      <div className="pa-states-detail" aria-live="polite">
        <p className={`flex items-center gap-2 text-md font-bold ${STATE_TEXT_CLASS[state]}`}>
          <StateIcon state={state} size={22} />
          {t(state)}
        </p>
        <p className="mt-2 max-w-(--measure)">{t(`${state}Long`)}</p>
        <p className="tabular mt-3 text-sm text-ink-muted">{shares[state].toFixed(1)}%</p>
      </div>
    </div>
  );
}
