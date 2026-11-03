import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LonLat } from "@/lib/api/contracts";

export interface Place {
  label: string;
  position: LonLat;
}

export interface TripState {
  origin: Place | null;
  destination: Place | null;
  selectedRouteId: string | null;
  setOrigin: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  swap: () => void;
  select: (id: string | null) => void;
  clear: () => void;
}

/** Destinations are sensitive: the current trip lives in sessionStorage only. */
export const useTrip = create<TripState>()(
  persist(
    (set) => ({
      origin: null,
      destination: null,
      selectedRouteId: null,
      setOrigin: (origin) => set({ origin, selectedRouteId: null }),
      setDestination: (destination) => set({ destination, selectedRouteId: null }),
      swap: () => set((s) => ({ origin: s.destination, destination: s.origin, selectedRouteId: null })),
      select: (selectedRouteId) => set({ selectedRouteId }),
      clear: () => set({ origin: null, destination: null, selectedRouteId: null }),
    }),
    { name: "pathable:trip", storage: createJSONStorage(() => sessionStorage), skipHydration: true, version: 1 },
  ),
);
