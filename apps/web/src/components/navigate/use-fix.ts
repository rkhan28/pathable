"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LonLat } from "@/lib/api/contracts";
import { type Journey, bearing as bearingOf, locate, metres, pointAt } from "@/lib/journey";

/**
 * Where the person is, from one of two sources:
 *
 *   live     the device's location (watchPosition), used when it is on or
 *            near the route;
 *   preview  a walker moving along the route, used when location is off or
 *            the person is somewhere else (planning from home). It can be
 *            paused and stepped, so it doubles as a step-by-step rehearsal.
 *
 * The source is chosen once, when guidance starts.
 */
export type FixSource = "locating" | "live" | "preview";
export type PreviewReason = "denied" | "unavailable" | "far";

export interface PositionFix {
  position: LonLat;
  /** Degrees clockwise from north, or null when standing still. */
  heading: number | null;
  accuracyM: number;
  /** Metres along the journey, and how far off its line the position is. */
  along: number;
  offRouteM: number;
  /** The nearest point on the line, used to draw the dot when close. */
  snapped: LonLat;
  /** When the fix arrived (ms since epoch). */
  at: number;
}

const NEAR_ROUTE_M = 250;
const PREVIEW_TICK_MS = 250;
/** The preview moves this many times faster than real life, so a 20-minute walk takes a minute or two. */
export const PREVIEW_SPEEDUP = 12;

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 }),
  );
}

function walker(j: Journey, along: number): PositionFix {
  const p = pointAt(j, along);
  return { position: p.position, heading: p.bearing, accuracyM: 0, along, offRouteM: 0, snapped: p.position, at: Date.now() };
}

export function useFix(journey: Journey) {
  const [source, setSource] = useState<FixSource>("locating");
  const [reason, setReason] = useState<PreviewReason | null>(null);
  const [fix, setFix] = useState<PositionFix | null>(null);
  const [playing, setPlaying] = useState(true);
  const along = useRef(0);
  const liveAlong = useRef(0);
  const journeyRef = useRef(journey);
  useLayoutEffect(() => {
    journeyRef.current = journey;
  });

  // Decide the source once.
  useEffect(() => {
    let cancelled = false;
    const preview = (why: PreviewReason) => {
      if (cancelled) return;
      setReason(why);
      setSource("preview");
    };
    if (!("geolocation" in navigator)) {
      preview("unavailable");
      return;
    }
    currentPosition().then(
      (p) => {
        const here: LonLat = [p.coords.longitude, p.coords.latitude];
        if (locate(journeyRef.current, here).offRouteM > NEAR_ROUTE_M) preview("far");
        else if (!cancelled) setSource("live");
      },
      (e: GeolocationPositionError) => preview(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Live: follow the device. Heading comes from the device when moving, or from the last two fixes.
  useEffect(() => {
    if (source !== "live") return;
    let last: LonLat | null = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const here: LonLat = [p.coords.longitude, p.coords.latitude];
        let heading = p.coords.heading;
        if ((heading === null || Number.isNaN(heading)) && last && metres(last, here) > 2) heading = bearingOf(last, here);
        last = here;
        const m = locate(journeyRef.current, here, liveAlong.current);
        liveAlong.current = m.along;
        setFix({
          position: here,
          heading: Number.isFinite(heading) ? heading : m.bearing,
          accuracyM: p.coords.accuracy,
          along: m.along,
          offRouteM: m.offRouteM,
          snapped: m.snapped,
          at: Date.now(),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [source]);

  // Preview: walk along the line. Vehicles keep their scheduled pace (also sped up).
  useEffect(() => {
    if (source !== "preview" || !playing) return;
    const id = window.setInterval(() => {
      const j = journeyRef.current;
      const ride = j.rides.find((r) => along.current >= r.startM && along.current < r.endM);
      const rideMps = ride ? (ride.endM - ride.startM) / Math.max(60, (Date.parse(ride.leg.arriveAt) - Date.parse(ride.leg.departAt)) / 1000) : 1;
      along.current = Math.min(j.totalM, along.current + rideMps * PREVIEW_SPEEDUP * (PREVIEW_TICK_MS / 1000));
      setFix(walker(j, along.current));
      if (along.current >= j.totalM) setPlaying(false);
    }, PREVIEW_TICK_MS);
    return () => window.clearInterval(id);
  }, [source, playing]);

  // A new journey (a reroute) starts the preview walker from the beginning.
  useEffect(() => {
    along.current = 0;
    liveAlong.current = 0;
  }, [journey]);

  /** Preview only: jump to a distance along the route (step back or forward). */
  const seek = (to: number) => {
    const j = journeyRef.current;
    along.current = Math.min(Math.max(0, to), j.totalM);
    setFix(walker(j, along.current));
  };

  return { source, reason, fix, playing, setPlaying, seek, tickMs: source === "preview" ? PREVIEW_TICK_MS : 1000 };
}
