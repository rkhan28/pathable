"use client";

import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import type { Hazard } from "@/lib/api/contracts";
import { useRouteFormat } from "@/lib/format";

/** A map hazard as a real button: filled circle when verified, dashed diamond when only reported. */
export function HazardMarker({ hazard }: { hazard: Hazard }) {
  const t = useTranslations();
  const f = useRouteFormat();
  const kind = t(`hazards.kinds.${hazard.kind}`);
  const status = t(`hazards.status.${hazard.status}`);
  return (
    <Popover.Root>
      <Popover.Trigger className="pa-hazard-button" aria-label={`${kind}, ${status}`}>
        <span className={hazard.status === "verified" ? "pa-hazard-dot is-verified" : "pa-hazard-dot is-reported"} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pa-popover" sideOffset={8} collisionPadding={16}>
          <p className="font-bold">{kind}</p>
          <p className="text-sm">{status}</p>
          <p className="text-sm text-ink-muted">{t("hazards.measured", { source: t(`sources.${hazard.source}`), date: f.date(hazard.observedOn) })}</p>
          <p className="text-sm text-ink-muted">{hazard.expiresAt ? t("hazards.expires", { date: f.date(hazard.expiresAt.slice(0, 10)) }) : t("hazards.noExpiry")}</p>
          <Popover.Arrow className="fill-[var(--surface-raised)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
