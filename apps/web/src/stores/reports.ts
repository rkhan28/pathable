import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HazardKind, LonLat, ReportStatus } from "@/lib/api/contracts";

export interface LocalReport {
  localId: string;
  kind: HazardKind;
  location: LonLat;
  description: string;
  observedOn: string;
  createdAt: string;
  /** null while it exists only on this device (a draft that was not sent). */
  serverId: string | null;
  status: ReportStatus | "draft";
}

interface ReportsState {
  reports: LocalReport[];
  upsert: (r: LocalReport) => void;
  remove: (localId: string) => void;
  clear: () => void;
}

export const useReports = create<ReportsState>()(
  persist(
    (set) => ({
      reports: [],
      upsert: (r) => set((s) => ({ reports: [r, ...s.reports.filter((x) => x.localId !== r.localId)] })),
      remove: (localId) => set((s) => ({ reports: s.reports.filter((x) => x.localId !== localId) })),
      clear: () => set({ reports: [] }),
    }),
    { name: "pathable:reports", storage: createJSONStorage(() => localStorage), skipHydration: true, version: 1 },
  ),
);
