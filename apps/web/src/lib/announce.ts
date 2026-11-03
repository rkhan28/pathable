/**
 * Screen reader announcements through two persistent live regions rendered by
 * <LiveRegions/> in the root layout. Polite for results, assertive only for
 * errors that block the task.
 */
export type Politeness = "polite" | "assertive";

export function announce(message: string, politeness: Politeness = "polite"): void {
  if (typeof document === "undefined") return;
  const region = document.getElementById(`live-${politeness}`);
  if (!region) return;
  // Clear first so repeating the same message is still announced.
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}
