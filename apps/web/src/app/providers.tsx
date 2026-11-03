"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { isRetryable } from "@/lib/api/errors";
import { usePreferences } from "@/stores/preferences";
import { useReports } from "@/stores/reports";
import { applySettings, useSettings } from "@/stores/settings";
import { useTrip } from "@/stores/trip";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        // Retry only errors the contract marks retryable, at most twice.
        retry: (count, error) => count < 2 && isRetryable(error),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/** Stores live outside the route tree and rehydrate after mount, so server and client HTML agree. */
function useRehydrateStores() {
  useEffect(() => {
    void useSettings.persist.rehydrate();
    void usePreferences.persist.rehydrate();
    void useTrip.persist.rehydrate();
    void useReports.persist.rehydrate();
  }, []);
}

function useApplySettings() {
  const theme = useSettings((s) => s.theme);
  const contrast = useSettings((s) => s.contrast);
  const motion = useSettings((s) => s.motion);
  const textScale = useSettings((s) => s.textScale);
  useEffect(() => {
    const apply = () => applySettings({ theme, contrast, motion, textScale });
    apply();
    const queries = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map((q) => matchMedia(q));
    queries.forEach((q) => q.addEventListener("change", apply));
    return () => queries.forEach((q) => q.removeEventListener("change", apply));
  }, [theme, contrast, motion, textScale]);
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  useRehydrateStores();
  useApplySettings();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
