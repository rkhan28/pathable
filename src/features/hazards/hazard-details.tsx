"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Hazard } from "@/api/contracts";
import { Badge } from "@/components/ui/feedback";
import { formatRelativeTime } from "@/lib/format";
import { HazardBadgeIcon, isWinterHazard } from "./hazard-visuals";

/** Accessible name for a hazard, used by map markers and lists. */
export function useHazardLabel() {
  const t = useTranslations("hazards");
  const locale = useLocale();
  return (h: Hazard) =>
    t("markerLabel", {
      type: t(`types.${h.type}`),
      status: t(`status.${h.status}`),
      when: t(h.status === "verified" && h.verifiedAt ? "verified" : "reported", {
        when: formatRelativeTime(h.status === "verified" && h.verifiedAt ? h.verifiedAt : h.reportedAt, locale),
      }),
    });
}

/** Every hazard shows type, status, severity, source and age — never just a coloured dot. */
export function HazardDetails({ hazard, headingLevel = 3 }: { hazard: Hazard; headingLevel?: 3 | 4 }) {
  const t = useTranslations("hazards");
  const locale = useLocale();
  const Heading = `h${headingLevel}` as const;
  const winter = isWinterHazard(hazard.type);
  return (
    <div className="flex gap-3">
      <HazardBadgeIcon hazard={hazard} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Heading className="font-semibold leading-snug">{t(`types.${hazard.type}`)}</Heading>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={hazard.status === "verified" ? "danger" : "warning"}>{t(`status.${hazard.status}`)}</Badge>
          <Badge tone="neutral">{t(`severity.${hazard.severity}`)}</Badge>
          {winter ? <Badge tone="winter">{t("winterBadge")}</Badge> : null}
        </div>
        <ul className="flex flex-col gap-0.5 text-sm text-fg-muted">
          <li>{t(`sources.${hazard.source}`)}</li>
          <li>
            {t("reported", { when: formatRelativeTime(hazard.reportedAt, locale) })}
            {hazard.verifiedAt ? `; ${t("verified", { when: formatRelativeTime(hazard.verifiedAt, locale) })}` : ""}
          </li>
          {hazard.confirmations > 0 ? <li>{t("confirmations", { count: hazard.confirmations })}</li> : null}
          {hazard.expiresAt ? <li>{t("expires", { when: formatRelativeTime(hazard.expiresAt, locale) })}</li> : null}
        </ul>
        {hazard.description ? <p className="text-sm">{hazard.description}</p> : null}
      </div>
    </div>
  );
}
