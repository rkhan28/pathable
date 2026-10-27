"use client";

import { useMutation } from "@tanstack/react-query";
import { CloudOffIcon, SendIcon, TrashIcon, Undo2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { toApiError } from "@/api/errors";
import { getService } from "@/api/service";
import { HazardBadgeIcon } from "@/features/hazards/hazard-visuals";
import { formatRelativeTime } from "@/lib/format";
import { useHydrated } from "@/lib/hooks";
import { useReports, type StoredReport } from "./report-store";

/** Reports made on this device, with honest sent / not-sent status, withdrawal and deletion. */
export function MyReports({ compact = false, showHeading = true }: { compact?: boolean; showHeading?: boolean }) {
  const t = useTranslations("report.mine");
  const tHaz = useTranslations("hazards");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const hydrated = useHydrated();
  const reports = useReports((s) => s.reports);
  const update = useReports((s) => s.update);
  const remove = useReports((s) => s.remove);

  const withdraw = useMutation({
    mutationFn: async (r: StoredReport) => (await getService()).withdrawReport(r.receipt!.id),
    onSuccess: (receipt, r) => {
      update(r.localId, { receipt });
      toast.success(t("withdrawn"));
    },
    onError: (e) => toast.error(tErrors(toApiError(e).code)),
  });

  const list = hydrated ? reports : [];
  const Heading = compact ? "h2" : "h3";

  return (
    <div className="flex flex-col gap-4">
      {showHeading ? (
        <Heading id="my-reports-heading" className="text-title font-semibold">
          {t("title")}
        </Heading>
      ) : null}
      {list.length === 0 ? (
        <EmptyState icon={SendIcon} title={t("empty")} className="rounded-lg border border-dashed border-border-strong px-4 py-8" />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => {
            const withdrawn = r.receipt?.status === "withdrawn";
            return (
              <li key={r.localId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
                <div className="flex items-start gap-3">
                  <HazardBadgeIcon hazard={{ type: r.submission.hazardType, status: "reported", severity: r.submission.severity }} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tHaz(`types.${r.submission.hazardType}`)}</p>
                    <p className="truncate text-sm text-fg-muted">{r.submission.locationLabel}</p>
                    <p className="text-sm text-fg-muted">{t("createdAt", { when: formatRelativeTime(r.createdAt, locale) })}</p>
                  </div>
                  {r.receipt ? (
                    <Badge tone={withdrawn ? "neutral" : "success"}>{withdrawn ? t("withdrawn") : t("sent")}</Badge>
                  ) : (
                    <Badge tone="warning">
                      <CloudOffIcon aria-hidden="true" />
                      {t("draft")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.receipt && !withdrawn ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={withdraw.isPending && withdraw.variables?.localId === r.localId}
                      onClick={() => {
                        if (window.confirm(t("confirmWithdraw"))) withdraw.mutate(r);
                      }}
                    >
                      <Undo2Icon aria-hidden="true" />
                      {t("withdraw")}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => remove(r.localId)} aria-label={`${t("delete")}: ${tHaz(`types.${r.submission.hazardType}`)}`}>
                    <TrashIcon aria-hidden="true" />
                    {t("delete")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
