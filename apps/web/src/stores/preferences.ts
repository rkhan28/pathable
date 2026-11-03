import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import defaults from "@/generated/fixtures/default-preferences.json";
import type { Preferences } from "@/lib/api/contracts";

export const PROFILES = [
  "manual_wheelchair",
  "powered_wheelchair",
  "mobility_scooter",
  "walker",
  "cane",
  "reduced_mobility",
  "stroller",
  "custom",
] as const;
export type Profile = (typeof PROFILES)[number];

export const DEFAULT_PREFERENCES: Preferences = defaults;

/**
 * A profile only pre-fills preferences; every value stays editable and the
 * profile itself is never sent to the API. Starting points, not assumptions:
 * 5% is the Ontario exterior path limit and 8.3% (1:12) a common ramp maximum.
 */
export const PROFILE_PRESETS: Record<Exclude<Profile, "custom">, Partial<Preferences>> = {
  manual_wheelchair: { maxRunningSlopePct: 5, minWidthM: 1.2, avoidStairs: true, avoidMissingRamps: true },
  powered_wheelchair: { maxRunningSlopePct: 6.7, minWidthM: 1.2, avoidStairs: true, avoidMissingRamps: true },
  mobility_scooter: { maxRunningSlopePct: 6.7, minWidthM: 1.2, avoidStairs: true, avoidMissingRamps: true },
  walker: { maxRunningSlopePct: 5, minWidthM: 0.9, avoidStairs: true, avoidMissingRamps: true },
  cane: { maxRunningSlopePct: 8.3, minWidthM: 0.9, avoidStairs: false, avoidMissingRamps: false, avoidNarrow: false },
  reduced_mobility: { maxRunningSlopePct: 5, minWidthM: 0.9, avoidStairs: true, avoidMissingRamps: false },
  stroller: { maxRunningSlopePct: 6.7, minWidthM: 0.9, avoidStairs: true, avoidMissingRamps: true },
};

export interface PreferencesState {
  profile: Profile | null;
  preferences: Preferences;
  onboarded: boolean;
  /** Personal notes stay on this device and are never sent anywhere. */
  notes: string;
  setProfile: (profile: Profile) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setNotes: (notes: string) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      profile: null,
      preferences: DEFAULT_PREFERENCES,
      onboarded: false,
      notes: "",
      setProfile: (profile) =>
        set((s) => ({
          profile,
          preferences: profile === "custom" ? s.preferences : { ...DEFAULT_PREFERENCES, ...PROFILE_PRESETS[profile] },
        })),
      setPreference: (key, value) =>
        set((s) => ({ preferences: { ...s.preferences, [key]: value }, profile: s.profile ? "custom" : null })),
      setNotes: (notes) => set({ notes }),
      completeOnboarding: () => set({ onboarded: true }),
      reset: () => set({ profile: null, preferences: DEFAULT_PREFERENCES, onboarded: false, notes: "" }),
    }),
    { name: "pathable:preferences", storage: createJSONStorage(() => localStorage), skipHydration: true, version: 1 },
  ),
);
