import type { UserMarker } from "@/components/map/route-map";

/**
 * Guidance updates the position up to four times a second. Passing that
 * through the planner's state would re-render the whole planner each time;
 * this small store lets only the map and the guidance screen subscribe.
 */
export interface NavCamera {
  user: UserMarker | null;
  follow: boolean;
}

let state: NavCamera = { user: null, follow: true };
const listeners = new Set<() => void>();

export const navCamera = {
  get: () => state,
  set: (patch: Partial<NavCamera>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  reset: () => navCamera.set({ user: null, follow: true }),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
