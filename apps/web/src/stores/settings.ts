import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeSetting = "system" | "light" | "dark";
export type ContrastSetting = "system" | "more" | "normal";
export type MotionSetting = "system" | "reduced" | "full";

export interface SettingsState {
  theme: ThemeSetting;
  contrast: ContrastSetting;
  motion: MotionSetting;
  /** 1 to 1.5; scales the root font size. */
  textScale: number;
  voice: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const SETTINGS_KEY = "pathable:settings";

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      contrast: "system",
      motion: "system",
      textScale: 1,
      voice: false,
      set: (patch) => set(patch),
    }),
    { name: SETTINGS_KEY, storage: createJSONStorage(() => localStorage), skipHydration: true, version: 1 },
  ),
);

/** Apply settings to <html>. The same logic runs inline before first paint (bootScript). */
export function applySettings(s: Pick<SettingsState, "theme" | "contrast" | "motion" | "textScale">): void {
  const root = document.documentElement;
  const dark = s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const more = s.contrast === "more" || (s.contrast === "system" && matchMedia("(prefers-contrast: more)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.contrast = more ? "more" : "normal";
  if (s.motion === "system") delete root.dataset.motion;
  else root.dataset.motion = s.motion;
  root.style.setProperty("--text-scale", String(Math.min(1.5, Math.max(1, s.textScale))));
}

/**
 * Inline script for <head>: applies persisted settings before first paint so
 * there is no theme or text-size flash. Kept dependency-free and tiny.
 */
export const bootScript = `(function(){try{var s={theme:"system",contrast:"system",motion:"system",textScale:1};var r=localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)});if(r){var p=JSON.parse(r).state||{};for(var k in s)if(k in p)s[k]=p[k]}var d=document.documentElement,m=function(q){return matchMedia(q).matches};d.dataset.theme=s.theme==="dark"||(s.theme==="system"&&m("(prefers-color-scheme: dark)"))?"dark":"light";d.dataset.contrast=s.contrast==="more"||(s.contrast==="system"&&m("(prefers-contrast: more)"))?"more":"normal";if(s.motion!=="system")d.dataset.motion=s.motion;d.style.setProperty("--text-scale",String(Math.min(1.5,Math.max(1,+s.textScale||1))))}catch(e){document.documentElement.dataset.theme="light";document.documentElement.dataset.contrast="normal"}})();`;
