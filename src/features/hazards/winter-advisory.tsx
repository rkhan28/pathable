"use client";

import { SnowflakeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Hazard } from "@/api/contracts";
import { Callout } from "@/components/ui/feedback";
import { formatRelativeTime } from "@/lib/format";
import { isWinterHazard } from "./hazard-visuals";

/**
 * Seasonal advisory shown only when there are actual on-the-ground winter
 * reports on the route. It never uses weather data.
 */
export function WinterAdvisory({ hazards }: { hazards: Hazard[] }) {
  const t = useTranslations("winter");
  const locale = useLocale();
  const winter = hazards.filter((h) => isWinterHazard(h.type) && h.status !== "resolved");
  if (winter.length === 0) return null;
  const newest = winter.map((h) => h.reportedAt).sort().at(-1)!;
  return (
    <Callout tone="winter" icon={SnowflakeIcon} title={t("advisoryTitle")}>
      <p>{t("advisoryBody", { count: winter.length })}</p>
      <p className="mt-1">{t("freshness", { when: formatRelativeTime(newest, locale) })}</p>
      <p className="mt-1 text-sm">{t("seasonalNote")}</p>
    </Callout>
  );
}
