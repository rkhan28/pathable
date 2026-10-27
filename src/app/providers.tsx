"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/misc";
import { Toaster } from "@/components/ui/sonner";
import { LiveRegions } from "@/features/a11y/announcer";
import { useTrip } from "@/features/navigation/trip-store";
import { useReports } from "@/features/reporting/report-store";
import { applyDisplaySettings, usePreferences, usePreferencesHydrated } from "@/features/preferences/store";

function DisplaySync() {
  const display = usePreferences((s) => s.display);
  const hydrated = usePreferencesHydrated();
  useEffect(() => {
    // Before hydration the boot script has already applied the saved settings.
    if (!hydrated) return;
    applyDisplaySettings(display);
    if (display.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDisplaySettings(display);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [display, hydrated]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => count < 2 && (error as { retryable?: boolean }).retryable === true,
          },
        },
      }),
  );
  const motion = usePreferences((s) => s.display.motion);

  useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useTrip.persist.rehydrate();
    void useReports.persist.rehydrate();
    // Signals "interactive" to automated tests and lets CSS avoid pre-hydration affordances.
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={motion === "reduce" ? "always" : "user"}>
        <DisplaySync />
        <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
        <LiveRegions />
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}
