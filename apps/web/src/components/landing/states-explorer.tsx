"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { KnowledgeState } from "@/lib/api/contracts";
import type { HeroData } from "@/lib/hero-data";
import { StateIcon, StateSwatch, STATE_TEXT_CLASS } from "@/components/route/state-icon";
import { HeroSvg } from "./hero-svg";

const ORDER: KnowledgeState[] = ["verified", "barrier", "unverified", "unknown"];
const CODE: Record<KnowledgeState, string> = { verified: "v", barrier: "b", unverified: "r", unknown: "u" };

/**
 * A specimen table of the four states: how each is drawn, what it means, and
 * how much of the demo corridor it covers (docs/DATA_REPORT.md). Choosing a
 * row isolates that state on the real corridor route.
 */
export function StatesExplorer({ shares, data }: { shares: Record<KnowledgeState, number>; data: HeroData }) {
  const t = useTranslations();
  const [state, setState] = useState<KnowledgeState>("unknown");
  const name = useId();
  return (
    <div className="pa-specimen">
      <fieldset className="pa-specimen-table">
        <legend className="sr-only">{t("states.legend")}</legend>
        <div className="pa-specimen-head" aria-hidden>
          <span>{t("landing.states.drawn")}</span>
          <span />
          <span className="text-end">{t("landing.states.share")}</span>
        </div>
        {ORDER.map((s) => (
          <label key={s} className="pa-specimen-row">
            <input type="radio" name={name} value={s} checked={state === s} onChange={() => setState(s)} className="sr-only" />
            <StateSwatch state={s} width={96} />
            <span className="min-w-0">
              <span className={`flex items-center gap-2 font-bold ${STATE_TEXT_CLASS[s]}`}>
                <StateIcon state={s} />
                <span className="text-ink">{t(`states.${s}`)}</span>
              </span>
              <span className="mt-1 block text-ink-muted">{t(`states.${s}Long`)}</span>
            </span>
            <span className="pa-specimen-share">
              <span className="tabular text-md">{shares[s].toFixed(1)}%</span>
              <span className="pa-share-track" aria-hidden>
                <span className="pa-share-fill" style={{ inlineSize: `${shares[s]}%`, background: s === "verified" ? "var(--signal)" : `var(--state-${s})` }} />
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="pa-specimen-map" aria-hidden>
        <HeroSvg data={data} profile="wheelchair" title={t("landing.states.mapLabel")} highlight={CODE[state]} onlySelected weight={1.8} />
      </div>
    </div>
  );
}
