// Shared between the server-rendered <head> script and the client store. No "use client" here.
export const PREFERENCES_STORAGE_KEY = "pathable:preferences";

/**
 * Inline, render-blocking script that applies display settings to <html>
 * before first paint (no theme flash, no text-size jump). Kept tiny and
 * dependency-free; mirrors applyDisplaySettings() in store.ts.
 */
export const DISPLAY_BOOT_SCRIPT = `(function(){try{var r=document.documentElement,s=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFERENCES_STORAGE_KEY,
)})||"{}").state||{},d=s.display||{},t=d.theme||"system",dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",dark);if(d.contrast==="high"||((!d.contrast||d.contrast==="system")&&matchMedia("(prefers-contrast: more)").matches))r.dataset.contrast="high";if(d.motion==="reduce")r.dataset.motion="reduce";if(d.textScale)r.style.setProperty("--text-scale",String(d.textScale));}catch(e){}})();`;
