"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { UserMarker } from "@/components/map/route-map";
import type { LonLat } from "@/lib/api/contracts";
import { bearing, metres } from "@/lib/journey";

export type TrackState = "off" | "follow" | "free";

/**
 * "Show my location" on the planner map. The first press starts watching the
 * device's position and the map follows it as you move; dragging the map
 * lets you look around (the dot keeps moving), and pressing again follows
 * once more. A third state never asks for location without a press.
 */
export function useTrack(messages: { denied: string; unavailable: string }) {
  const [state, setState] = useState<TrackState>("off");
  const [user, setUser] = useState<UserMarker | null>(null);

  useEffect(() => {
    if (state === "off") return;
    let last: LonLat | null = null;
    let heading = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const here: LonLat = [p.coords.longitude, p.coords.latitude];
        if (p.coords.heading !== null && Number.isFinite(p.coords.heading)) heading = p.coords.heading;
        else if (last && metres(last, here) > 2) heading = bearing(last, here);
        last = here;
        setUser({ position: here, bearing: heading, durationMs: 1000 });
      },
      (e) => {
        toast(e.code === e.PERMISSION_DENIED ? messages.denied : messages.unavailable);
        setState("off");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
    // Restart only when tracking is switched on or off, not between follow and free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === "off"]);

  const press = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast(messages.unavailable);
      return;
    }
    setState((s) => (s === "follow" ? "off" : "follow"));
  }, [messages.unavailable]);
  const release = useCallback(() => setState((s) => (s === "follow" ? "free" : s)), []);
  // Turning tracking off removes the dot.
  return { state, user: state === "off" ? null : user, press, release };
}
