"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MobilityPreferencesSchema, type MobilityPreferences, type MobilityProfileId } from "@/api/contracts";
import { PREFERENCES_STORAGE_KEY } from "./boot-script";
import { DEFAULT_PREFERENCES, preferencesForProfile } from "./profiles";

export { PREFERENCES_STORAGE_KEY };

export type ThemePreference = "system" | "light" | "dark";
export type ContrastPreference = "system" | "standard" | "high";
export type MotionPreference = "system" | "reduce";
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export interface DisplaySettings {
  theme: ThemePreference;
  contrast: ContrastPreference;
  motion: MotionPreference;
  textScale: TextScale;
  voiceGuidance: boolean;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  theme: "system",
  contrast: "system",
  motion: "system",
  textScale: 1,
  voiceGuidance: false,
};

export type OnboardingStatus = "pending" | "completed" | "skipped";

interface PreferencesState {
  mobility: MobilityPreferences;
  display: DisplaySettings;
  onboarding: OnboardingStatus;
  /** Free-text needs the person chose to note. Stays on this device; never sent to the API. */
  personalNotes: string;
  setProfile: (profile: MobilityProfileId) => void;
  updateMobility: (patch: Partial<MobilityPreferences>) => void;
  replaceMobility: (prefs: MobilityPreferences) => void;
  setDisplay: (patch: Partial<DisplaySettings>) => void;
  setOnboarding: (status: OnboardingStatus) => void;
  setPersonalNotes: (notes: string) => void;
  reset: () => void;
}


export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      mobility: DEFAULT_PREFERENCES,
      display: DEFAULT_DISPLAY,
      onboarding: "pending",
      personalNotes: "",
      setProfile: (profile) => set({ mobility: preferencesForProfile(profile) }),
      updateMobility: (patch) => set((s) => ({ mobility: { ...s.mobility, ...patch } })),
      replaceMobility: (prefs) => set({ mobility: prefs }),
      setDisplay: (patch) => set((s) => ({ display: { ...s.display, ...patch } })),
      setOnboarding: (onboarding) => set({ onboarding }),
      setPersonalNotes: (personalNotes) => set({ personalNotes: personalNotes.slice(0, 1000) }),
      reset: () => set({ mobility: DEFAULT_PREFERENCES, display: DEFAULT_DISPLAY, onboarding: "pending", personalNotes: "" }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      // Rehydrated explicitly after mount (see Providers) so the first client
      // render matches the server HTML and React doesn't report a mismatch.
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ mobility, display, onboarding, personalNotes }) => ({ mobility, display, onboarding, personalNotes }),
      // Never trust persisted data blindly: invalid mobility data falls back to defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PreferencesState>;
        const mobility = MobilityPreferencesSchema.safeParse(p.mobility);
        return {
          ...current,
          ...p,
          mobility: mobility.success ? mobility.data : current.mobility,
          display: { ...DEFAULT_DISPLAY, ...(p.display ?? {}) },
        };
      },
    },
  ),
);

export function applyDisplaySettings(display: DisplaySettings) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = display.theme === "dark" || (display.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  const prefersMore = window.matchMedia("(prefers-contrast: more)").matches;
  if (display.contrast === "high" || (display.contrast === "system" && prefersMore)) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (display.motion === "reduce") root.dataset.motion = "reduce";
  else delete root.dataset.motion;
  root.style.setProperty("--text-scale", String(display.textScale));
}

/** True once persisted preferences have been loaded from localStorage. */
export function usePreferencesHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => usePreferences.persist.onFinishHydration(cb),
    () => usePreferences.persist.hasHydrated(),
    () => false,
  );
}
