"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/api/contracts";

export type GeoError = "denied" | "unavailable" | "unsupported";

export function useGeolocation() {
  const [state, setState] = useState<{ loading: boolean; error: GeoError | null; accuracy: number | null }>({
    loading: false,
    error: null,
    accuracy: null,
  });

  const locate = useCallback(
    () =>
      new Promise<LatLng | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setState({ loading: false, error: "unsupported", accuracy: null });
          resolve(null);
          return;
        }
        setState((s) => ({ ...s, loading: true, error: null }));
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setState({ loading: false, error: null, accuracy: Math.round(pos.coords.accuracy) });
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            setState({ loading: false, error: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable", accuracy: null });
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
        );
      }),
    [],
  );

  return { ...state, locate };
}
