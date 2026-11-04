"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getService } from "@/lib/api/select-service";
import { PathAbleError } from "@/lib/api/errors";
import { useRouteFormat } from "@/lib/format";
import { useReports, type LocalReport } from "@/stores/reports";

/** Reports made on this device, honest about drafts that were never sent. */
export function MyReports() {
  const t = useTranslations();
  const f = useRouteFormat();
  const reports = useReports((s) => s.reports);
  const upsert = useReports((s) => s.upsert);
  const remove = useReports((s) => s.remove);
  const withdraw = useMutation({
    mutationFn: async (r: LocalReport) => (await getService()).withdrawReport(r.serverId!, r.withdrawToken!),
    onSuccess: (receipt, r) => upsert({ ...r, status: receipt.status }),
    onError: (e) => toast(t(`errors.${e instanceof PathAbleError ? e.code : "internal"}`)),
  });
  return (
    <section aria-labelledby="mine-title" className="pa-settings-group">
      <h2 id="mine-title" className="text-lg">
        {t("report.mine")}
      </h2>
      {reports.length === 0 ? (
        <p className="text-ink-muted">{t("report.mineEmpty")}</p>
      ) : (
        <ul className="grid gap-3">
          {reports.map((r) => (
            <li key={r.localId} className="pa-section-card">
              <p className="font-bold">{t(`hazards.kinds.${r.kind}`)}</p>
              <p className="text-sm">{t(`report.status.${r.status}`)}</p>
              <p className="text-sm text-ink-muted">{f.date(r.observedOn)}</p>
              {/* Sent before withdrawals needed proof of ownership: nothing on this device can prove it now. */}
              {r.serverId && r.status !== "withdrawn" && !r.withdrawToken && <p className="mt-2 text-sm text-ink-muted">{t("report.withdrawNoToken")}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.serverId && r.status !== "withdrawn" && r.withdrawToken && (
                  <button type="button" className="pa-chip-button" onClick={() => withdraw.mutate(r)} disabled={withdraw.isPending}>
                    {t("report.withdraw")}
                  </button>
                )}
                <button type="button" className="pa-chip-button" onClick={() => remove(r.localId)}>
                  {t("report.deleteLocal")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
