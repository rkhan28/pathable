"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ReportReceipt, ReportSubmission } from "@/api/contracts";

/**
 * Reports made on this device. A report is either a local draft (the backend
 * wasn't reachable/configured — it has NOT been shared) or sent (has a server receipt).
 * Photos are not persisted locally; only the structured report.
 */
export interface StoredReport {
  localId: string;
  createdAt: string;
  submission: ReportSubmission;
  receipt: ReportReceipt | null;
}

interface ReportsState {
  reports: StoredReport[];
  add: (report: StoredReport) => void;
  update: (localId: string, patch: Partial<StoredReport>) => void;
  remove: (localId: string) => void;
  clear: () => void;
}

export const useReports = create<ReportsState>()(
  persist(
    (set) => ({
      reports: [],
      add: (report) => set((s) => ({ reports: [report, ...s.reports].slice(0, 100) })),
      update: (localId, patch) => set((s) => ({ reports: s.reports.map((r) => (r.localId === localId ? { ...r, ...patch } : r)) })),
      remove: (localId) => set((s) => ({ reports: s.reports.filter((r) => r.localId !== localId) })),
      clear: () => set({ reports: [] }),
    }),
    { name: "pathable:reports", storage: createJSONStorage(() => localStorage), version: 1, skipHydration: true },
  ),
);

export function useReportsHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useReports.persist.onFinishHydration(cb),
    () => useReports.persist.hasHydrated(),
    () => false,
  );
}
