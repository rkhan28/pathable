"use client";

import { LightbulbIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Route } from "@/api/contracts";
import { formatDistance, formatPercent } from "@/lib/format";
import { explainRoute } from "./explain";

/** "Why this route?" — plain-language reasoning derived from the ranking facts. */
export function RouteExplanation({ routes, routeId }: { routes: Route[]; routeId: string }) {
  const t = useTranslations("routes");
  const locale = useLocale();
  const e = explainRoute(routes, routeId);
  if (!e) return null;

  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const sentences: string[] = [];

  if (e.isOnly) sentences.push(t("explanation.only"));
  else if (e.isSuggested) {
    sentences.push(
      e.reasons.length
        ? t("explanation.suggested", { reasons: list.format(e.reasons.map((r) => t(`reasons.${r}`))) })
        : t("explanation.suggestedNoReasons"),
    );
  }
  if (!e.isOnly) {
    sentences.push(e.isShortest ? t("explanation.shortest") : t("explanation.longer", { difference: formatDistance(e.extraDistanceMeters, locale) }));
  }
  if (e.conflicts.length) {
    sentences.push(t("explanation.conflictsWith", { preferences: list.format(e.conflicts.map((c) => t(`conflicts.${c}`))) }));
  }

  return (
    <section aria-labelledby="why-route" className="rounded-lg bg-accent-soft/70 p-4">
      <h3 id="why-route" className="flex items-center gap-2 font-semibold">
        <LightbulbIcon className="size-4 text-accent" aria-hidden="true" />
        {t("why")}
      </h3>
      <p className="mt-1.5 leading-relaxed">{sentences.join(" ")}</p>
      {e.others.length ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-sm text-fg-muted">
          {e.others
            .sort((a, b) => a.rank - b.rank)
            .map((o) => (
              <li key={o.id}>
                {t("explanation.alternative", {
                  rank: o.rank,
                  summary: list.format([
                    formatDistance(o.distanceMeters, locale),
                    t("explanation.comparedBarriers", { count: o.knownBarrierCount }),
                    t("explanation.comparedVerified", { percent: formatPercent(o.verifiedShare, locale) }),
                  ]),
                })}
              </li>
            ))}
        </ul>
      ) : null}
      <p className="mt-2 text-sm text-fg-muted">{t("unknownCaveat")}</p>
    </section>
  );
}
