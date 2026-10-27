"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Place } from "@/api/geocoding";

/**
 * The trip being planned. Persisted to sessionStorage (not localStorage):
 * a destination is sensitive and shouldn't outlive the browser session.
 * Living outside the route tree means switching language mid-trip keeps it.
 */
interface TripState {
  origin: Place | null;
  destination: Place | null;
  selectedRouteId: string | null;
  /** Text the landing page search passed through without picking a suggestion. */
  pendingQuery: string | null;
  recent: Place[];
  setOrigin: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  swap: () => void;
  selectRoute: (id: string | null) => void;
  setPendingQuery: (q: string | null) => void;
  clear: () => void;
}

export const useTrip = create<TripState>()(
  persist(
    (set) => ({
      origin: null,
      destination: null,
      selectedRouteId: null,
      pendingQuery: null,
      recent: [],
      setOrigin: (origin) =>
        set((s) => (samePlace(s.origin, origin) ? {} : { origin, selectedRouteId: null, recent: remember(s.recent, origin) })),
      setDestination: (destination) =>
        set((s) => (samePlace(s.destination, destination) ? {} : { destination, selectedRouteId: null, recent: remember(s.recent, destination) })),
      swap: () => set((s) => ({ origin: s.destination, destination: s.origin, selectedRouteId: null })),
      selectRoute: (selectedRouteId) => set({ selectedRouteId }),
      setPendingQuery: (pendingQuery) => set({ pendingQuery }),
      clear: () => set({ origin: null, destination: null, selectedRouteId: null, pendingQuery: null }),
    }),
    { name: "pathable:trip", storage: createJSONStorage(() => sessionStorage), version: 1, skipHydration: true },
  ),
);

/** Same point (to ~1 m) — e.g. a shared link re-applied after a language switch. */
function samePlace(a: Place | null, b: Place | null) {
  return a !== null && b !== null && Math.abs(a.location.lat - b.location.lat) < 1e-5 && Math.abs(a.location.lng - b.location.lng) < 1e-5;
}

function remember(list: Place[], place: Place | null): Place[] {
  if (!place || place.kind === "current_location" || place.kind === "coordinates") return list;
  return [place, ...list.filter((p) => p.id !== place.id)].slice(0, 5);
}

export function useTripHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useTrip.persist.onFinishHydration(cb),
    () => useTrip.persist.hasHydrated(),
    () => false,
  );
}
