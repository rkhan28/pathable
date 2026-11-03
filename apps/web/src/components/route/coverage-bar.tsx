import { useTranslations } from "next-intl";
import type { KnowledgeState } from "@/lib/api/contracts";
import { StateIcon, StateSwatch, STATE_TEXT_CLASS } from "./state-icon";

const ORDER: KnowledgeState[] = ["verified", "unverified", "unknown", "barrier"];
const FILL: Record<KnowledgeState, string> = {
  verified: "var(--signal)",
  barrier: "var(--state-barrier)",
  unverified: "url(#pa-pattern-unverified)",
  unknown: "url(#pa-pattern-unknown)",
};

/** SVG patterns used by every coverage bar; render once per page. */
export function CoveragePatterns() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <defs>
        <pattern id="pa-pattern-unverified" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="var(--surface-raised)" />
          <rect width="5" height="8" fill="var(--state-unverified)" />
        </pattern>
        <pattern id="pa-pattern-unknown" width="6" height="8" patternUnits="userSpaceOnUse">
          <rect width="6" height="8" fill="var(--surface-sunken)" />
          <circle cx="3" cy="4" r="1.6" fill="var(--state-unknown)" />
        </pattern>
      </defs>
    </svg>
  );
}

/**
 * How much of a route is in each knowledge state, by length. Colour plus
 * pattern in the bar, and the same numbers as text, so it reads without colour.
 */
export function CoverageBar({ lengthByState, compact = false }: { lengthByState: Record<KnowledgeState, number>; compact?: boolean }) {
  const t = useTranslations();
  const total = ORDER.reduce((a, s) => a + lengthByState[s], 0) || 1;
  const pct = (s: KnowledgeState) => (lengthByState[s] / total) * 100;
  const offsets = ORDER.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + pct(ORDER[i - 1])], []);
  return (
    <div>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="pa-coverage-bar" aria-hidden>
        {ORDER.map((s, i) => (pct(s) > 0 ? <rect key={s} x={offsets[i]} y={0} width={pct(s)} height={8} fill={FILL[s]} /> : null))}
      </svg>
      <ul className={compact ? "sr-only" : "pa-coverage-legend"} aria-label={t("route.coverage")}>
        {ORDER.map((s) => (
          <li key={s} className={STATE_TEXT_CLASS[s]}>
            {!compact && <StateSwatch state={s} width={22} />}
            <StateIcon state={s} size={16} className="max-md:hidden" />
            <span className="text-ink">{t("states." + s)}</span>
            <span className="tabular text-ink">{Math.round(pct(s))}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
