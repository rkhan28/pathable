"use client";

import { Toaster as Sonner } from "sonner";
import { usePreferences } from "@/features/preferences/store";

/**
 * Sonner toasts (MIT). Toasts are only used for non-critical confirmations;
 * anything safety-relevant is rendered inline and announced via LiveRegions,
 * because toasts disappear before some people can read them.
 */
export function Toaster() {
  const theme = usePreferences((s) => s.display.theme);
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      duration={6000}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-surface-raised !text-fg !shadow-3 !font-sans !text-[0.95rem]",
          description: "!text-fg-muted",
          closeButton: "!bg-surface-raised !border-border",
        },
      }}
    />
  );
}
