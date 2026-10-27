"use client";

import { FlaskConicalIcon, PlugZapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Callout } from "@/components/ui/feedback";
import { Link } from "@/i18n/navigation";
import type { BackendMode } from "@/lib/env";

/**
 * Persistent honesty banner. In fixture mode it can be collapsed to a one-line
 * label but never dismissed entirely — sample routes must always be labelled.
 */
export function BackendNotice({ mode }: { mode: BackendMode }) {
  const t = useTranslations("backend");
  const tNav = useTranslations("nav");
  const [expanded, setExpanded] = useState(false);
  if (mode === "live") return null;
  if (mode === "unavailable") {
    return (
      <Callout tone="info" icon={PlugZapIcon} title={t("unavailableTitle")} role="note">
        {t("unavailableBody")}
      </Callout>
    );
  }
  return (
    <div className="rounded-lg border-2 border-unverified/50 bg-unverified-soft" data-testid="sample-data-notice">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2 text-start font-semibold"
      >
        <FlaskConicalIcon className="size-5 shrink-0 text-unverified" aria-hidden="true" />
        <span className="flex-1">{expanded ? t("fixturesTitle") : t("fixturesShort")}</span>
        <span className="text-sm font-medium text-fg-muted underline underline-offset-2">{t("details")}</span>
      </button>
      {expanded ? (
        <div className="px-4 pb-3 text-[0.95rem] leading-relaxed text-fg-muted">
          <p>{t("fixturesBody")}</p>
          <Link href="/coverage" className="mt-1 inline-block font-semibold text-fg underline underline-offset-2">
            {tNav("coverage")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
