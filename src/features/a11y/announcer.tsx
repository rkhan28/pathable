"use client";

import { create } from "zustand";
import { useHydrated } from "@/lib/hooks";

/**
 * Screen-reader announcements. Two persistent live regions are rendered once
 * in the root layout; components call `announce()` instead of sprinkling
 * aria-live everywhere (which leads to duplicate or dropped announcements).
 */
interface AnnouncerState {
  polite: string;
  assertive: string;
  announce: (message: string, politeness?: "polite" | "assertive") => void;
}

export const useAnnouncer = create<AnnouncerState>()((set) => ({
  polite: "",
  assertive: "",
  announce: (message, politeness = "polite") => {
    // Clear first so repeating the same message is still announced.
    set({ [politeness]: "" } as Partial<AnnouncerState>);
    setTimeout(() => set({ [politeness]: message } as Partial<AnnouncerState>), 60);
  },
}));

export const announce = (message: string, politeness: "polite" | "assertive" = "polite") =>
  useAnnouncer.getState().announce(message, politeness);

export function LiveRegions() {
  const polite = useAnnouncer((s) => s.polite);
  const assertive = useAnnouncer((s) => s.assertive);
  // Regions must exist in the DOM (empty) before content changes for AT to pick them up.
  const mounted = useHydrated();
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-polite">
        {mounted ? polite : ""}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="live-assertive">
        {mounted ? assertive : ""}
      </div>
    </>
  );
}
