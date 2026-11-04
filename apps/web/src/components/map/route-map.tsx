"use client";

import type { Map as MlMap, Marker } from "maplibre-gl";
import { Crosshair, LocateFixed, Minus, Navigation2, Plus, Scan } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Hazard, LonLat } from "@/lib/api/contracts";
import { cameraDuration, duration, easeOutCubic, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";
import "maplibre-gl/dist/maplibre-gl.css";
import { hasWebGL, loadMapLibre } from "./maplibre";
import { brandStyle, fallbackStyle, readMapColors, type MapColors } from "./map-style";
import {
  type MapRoute,
  type RideLine,
  installRouteLayers,
  routeBounds,
  setDrawProgress,
  setFlowPhase,
  setIsolation,
  setRides,
  setRoutes,
} from "./route-layers";

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface RouteMapProps {
  routes: MapRoute[];
  selectedId: string | null;
  isolatedId?: string | null;
  origin?: LonLat | null;
  destination?: LonLat | null;
  hazards?: Hazard[];
  renderHazard?: (hazard: Hazard) => ReactNode;
  padding?: Padding;
  label: string;
  interactive?: boolean;
  controls?: boolean;
  drawOn?: boolean;
  flow?: boolean;
  /** Re-fit the camera to the selected route whenever this value changes. */
  fitTrigger?: string | number;
  /** Changing `key` flies the camera to `position` ("show on map"). */
  focusPoint?: { position: LonLat; key: number } | null;
  /** When set, the next map click is reported here (choose on map). */
  onPick?: ((position: LonLat) => void) | null;
  /** Rendered instead of the map when WebGL is missing. */
  fallback?: ReactNode;
  className?: string;
  onStatus?: (status: MapStatus) => void;
  /** Transit rides, drawn in each line's colour. */
  rides?: RideLine[];
  /** The person's position during guidance; glides to each new fix over `durationMs`. */
  user?: UserMarker | null;
  /** While true, the camera follows `user`, tilted and turned to face the way ahead. */
  follow?: boolean;
  /** Called when the person drags or zooms the map during guidance. */
  onFollowBreak?: () => void;
  /** "navigate" tilts and turns the map to the way ahead; "track" keeps it flat and north-up. */
  followMode?: "navigate" | "track";
  /** Shows a "my location" button; its state says whether the map is following. */
  onLocate?: () => void;
  locateState?: "off" | "follow" | "free";
}

export interface UserMarker {
  position: LonLat;
  bearing: number;
  durationMs: number;
}

export type MapStatus = "loading" | "ready" | "fallback-style" | "no-webgl";

const noopSubscribe = () => () => {};
const DEFAULT_PADDING: Padding = { top: 48, bottom: 48, left: 48, right: 48 };
const FLOW_PERIOD_MS = 7000;
const FLOW_TICK_MS = 100;
const DRAW_STEPS = 8;
const NO_RIDES: RideLine[] = [];
// During guidance the dot sits low on screen, so more of the way ahead is visible.
const FOLLOW_PADDING: Padding = { top: 240, bottom: 140, left: 40, right: 40 };
const FOLLOW_ZOOM = 17.6;
const FOLLOW_PITCH = 50;

function userMarker() {
  const el = document.createElement("div");
  el.className = "pa-user";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="pa-user-halo"></span><span class="pa-user-cone"></span><span class="pa-user-dot"></span>';
  return el;
}

/** Shortest turn from a to b, so 350 to 10 degrees turns 20 degrees, not 340. */
function turn(a: number, b: number) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const k = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(a[1] * k), b[1] - a[1]) * 111.32;
}

function endpointMarker(kind: "origin" | "destination") {
  const el = document.createElement("div");
  el.className = kind === "origin" ? "pa-marker-origin" : "pa-marker-destination";
  el.setAttribute("aria-hidden", "true");
  return el;
}

export function RouteMap({
  routes,
  selectedId,
  isolatedId = null,
  origin,
  destination,
  hazards = [],
  renderHazard,
  padding = DEFAULT_PADDING,
  label,
  interactive = true,
  controls = true,
  drawOn = true,
  flow = true,
  onPick,
  focusPoint = null,
  fitTrigger = 0,
  fallback,
  className,
  onStatus,
  rides = NO_RIDES,
  user = null,
  follow = false,
  onFollowBreak,
  followMode = "navigate",
  onLocate,
  locateState = "off",
}: RouteMapProps) {
  const t = useTranslations("planner");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const colorsRef = useRef<MapColors | null>(null);
  const styleFailedRef = useRef(false);
  const drawingRef = useRef(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [styleVersion, setStyleVersion] = useState(0);
  const [hazardEls, setHazardEls] = useState<{ hazard: Hazard; el: HTMLElement }[]>([]);
  const latest = useRef({ routes, selectedId, isolatedId, padding, onPick, onFollowBreak, follow });
  useLayoutEffect(() => {
    latest.current = { routes, selectedId, isolatedId, padding, onPick, onFollowBreak, follow };
  });
  const webgl = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);

  useEffect(() => onStatus?.(webgl ? status : "no-webgl"), [status, webgl, onStatus]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || !webgl) return;
    let cancelled = false;
    let map: MlMap | null = null;
    void loadMapLibre().then((ml) => {
      if (cancelled || !containerRef.current) return;
      const colors = readMapColors();
      colorsRef.current = colors;
      const bounds = routeBounds(latest.current.routes);
      map = new ml.Map({
        container: containerRef.current,
        style: brandStyle(colors, locale),
        bounds: bounds ?? undefined,
        center: bounds ? undefined : [-79.4556, 43.7675],
        zoom: bounds ? undefined : 12.5,
        fitBoundsOptions: { padding: latest.current.padding },
        interactive,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        maxBounds: [[-79.75, 43.6], [-79.15, 43.9]],
        fadeDuration: 0,
      });
      mapRef.current = map;
      map.getCanvas().setAttribute("aria-label", label);
      map.on("style.load", () => {
        installRouteLayers(map!, colorsRef.current!);
        setStyleVersion((v) => v + 1);
      });
      map.on("load", () => setStatus(styleFailedRef.current ? "fallback-style" : "ready"));
      map.on("error", (e) => {
        // Tiles, glyphs or the style failed: fall back to a plain background so routes still show.
        const msg = String((e.error as Error | undefined)?.message ?? "");
        if (!styleFailedRef.current && /tile|glyph|style|Failed to fetch|NetworkError|AJAXError/i.test(msg)) {
          styleFailedRef.current = true;
          map!.setStyle(fallbackStyle(colorsRef.current!));
          setStatus("fallback-style");
        }
      });
      map.on("click", (e) => latest.current.onPick?.([e.lngLat.lng, e.lngLat.lat]));
      // A drag, pinch or wheel by the person (not our own camera moves) stops following.
      const breakFollow = (e: { originalEvent?: unknown }) => {
        if (e.originalEvent && latest.current.follow) latest.current.onFollowBreak?.();
      };
      map.on("dragstart", breakFollow);
      map.on("zoomstart", breakFollow);
      map.on("rotatestart", breakFollow);
      // Test hook: how many route features are actually drawn, and whether basemap tiles rendered.
      map.on("idle", () => {
        const el = containerRef.current;
        if (!el || !map) return;
        const layers = ["pa-sel-verified", "pa-sel-barrier", "pa-sel-unverified", "pa-sel-unknown", "pa-alt"].filter((id) => map!.getLayer(id));
        el.dataset.renderedFeatures = String(map.queryRenderedFeatures({ layers }).length);
        el.dataset.basemapFeatures = String(map.getLayer("road") ? map.queryRenderedFeatures({ layers: ["road"] }).length : 0);
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once; props flow in through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme or contrast changed: re-read colours and swap the style; layers reinstall on style.load.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      colorsRef.current = readMapColors();
      map.setStyle(styleFailedRef.current ? fallbackStyle(colorsRef.current) : brandStyle(colorsRef.current, locale));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-contrast"] });
    return () => observer.disconnect();
  }, [locale]);

  // Route data, selection and the draw-on.
  const selectedRoute = routes.find((r) => r.id === selectedId) ?? routes[0];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !map.getLayer("pa-sel-casing")) return;
    setRoutes(map, routes, selectedRoute?.id ?? null);
    if (!drawOn || prefersReducedMotion()) {
      setDrawProgress(map, 1);
      return;
    }
    // Each filter change makes MapLibre re-process the route data, so reveal the
    // line in a few steps rather than on every frame: it reads as a draw-on at a
    // fraction of the cost.
    let frame = 0;
    let lastStep = -1;
    drawingRef.current = true;
    const start = performance.now();
    const total = duration.route * 1000;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / total);
      const step = Math.ceil(easeOutCubic(p) * DRAW_STEPS);
      if (step !== lastStep) {
        setDrawProgress(map, step / DRAW_STEPS);
        lastStep = step;
      }
      if (p < 1) frame = requestAnimationFrame(tick);
      else drawingRef.current = false;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      drawingRef.current = false;
    };
  }, [routes, selectedRoute?.id, styleVersion, drawOn]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0) return;
    setRides(map, rides);
  }, [rides, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !map.getLayer("pa-alt")) return;
    setIsolation(map, isolatedId, selectedRoute?.id ?? null);
  }, [isolatedId, selectedRoute?.id, styleVersion]);

  // Slow directional flow along the selected route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !flow || prefersReducedMotion()) return;
    let frame = 0;
    let last = 0;
    // Updating a line gradient re-uploads it to the GPU, so the flow ticks at
    // 10 fps and pauses while the route draws on, the camera moves, or the tab is hidden.
    const tick = (now: number) => {
      if (now - last > FLOW_TICK_MS && document.visibilityState === "visible" && !drawingRef.current && !map.isMoving()) {
        setFlowPhase(map, (now % FLOW_PERIOD_MS) / FLOW_PERIOD_MS, colorsRef.current?.casing ?? "#ffffff");
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flow, styleVersion, selectedRoute?.id]);

  // The route stays framed above the sheet as it moves: each padding change
  // re-frames instantly (no animation, so nothing restarts dozens of times a
  // second during a drag). Padding is only ever passed to fitBounds; MapLibre
  // adds setPadding() padding on top of it, which double-counted the sheet.
  // A change during a camera animation waits for it to finish.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const { routes: rs, selectedId: sel, padding: pad, follow: following } = latest.current;
      if (following) return;
      const route = rs.find((r) => r.id === sel) ?? rs[0];
      const b = route ? routeBounds([route]) : null;
      if (b) map.fitBounds(b, { padding: pad, duration: 0 });
    };
    if (map.isMoving()) {
      map.once("moveend", apply);
      return () => {
        map.off("moveend", apply);
      };
    }
    apply();
  }, [padding.top, padding.bottom, padding.left, padding.right]);

  // The camera re-fits when the selected route changes or when `fitTrigger`
  // changes (the sheet settling at a new snap point).
  const fitKey = `${selectedRoute?.id}|${fitTrigger}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRoute || latest.current.follow) return;
    const b = routeBounds([selectedRoute]);
    if (!b) return;
    const reduced = prefersReducedMotion();
    map.fitBounds(b, {
      padding: latest.current.padding,
      duration: reduced ? 0 : cameraDuration(distanceKm(b[0], b[1])),
      easing: easeOutCubic,
      essential: false,
    });
    // fitKey captures the selection and the trigger; padding is read at fit time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, styleVersion === 0]);

  // The person's dot glides from fix to fix instead of jumping; the camera eases alongside it.
  const userRef = useRef<{ marker: Marker; position: LonLat; bearing: number; frame: number } | null>(null);
  const followingRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!user) {
      if (userRef.current) {
        cancelAnimationFrame(userRef.current.frame);
        userRef.current.marker.remove();
        userRef.current = null;
      }
      return;
    }
    let cancelled = false;
    void loadMapLibre().then((ml) => {
      if (cancelled) return;
      const reduced = prefersReducedMotion();
      if (!userRef.current) {
        const marker = new ml.Marker({ element: userMarker(), rotationAlignment: "map", pitchAlignment: "viewport" })
          .setLngLat(user.position)
          .setRotation(user.bearing)
          .addTo(map);
        userRef.current = { marker, position: user.position, bearing: user.bearing, frame: 0 };
        return;
      }
      const u = userRef.current;
      cancelAnimationFrame(u.frame);
      const from = u.position;
      const fromBearing = u.bearing;
      const delta = turn(fromBearing, user.bearing);
      const start = performance.now();
      const total = reduced ? 0 : user.durationMs;
      const step = (now: number) => {
        const p = total ? Math.min(1, (now - start) / total) : 1;
        u.position = [from[0] + (user.position[0] - from[0]) * p, from[1] + (user.position[1] - from[1]) * p];
        u.bearing = fromBearing + delta * p;
        u.marker.setLngLat(u.position).setRotation(u.bearing);
        if (p < 1) u.frame = requestAnimationFrame(step);
      };
      u.frame = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
    };
    // status: a position can arrive before the map exists; place the dot once it does.
  }, [user, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !user || !follow) return;
    const reduced = prefersReducedMotion();
    const first = !followingRef.current;
    followingRef.current = true;
    const navigate = followMode === "navigate";
    map.easeTo({
      center: user.position,
      bearing: navigate ? user.bearing : 0,
      pitch: navigate ? FOLLOW_PITCH : 0,
      zoom: first ? (navigate ? FOLLOW_ZOOM : Math.max(map.getZoom(), 16)) : map.getZoom(),
      padding: navigate ? FOLLOW_PADDING : latest.current.padding,
      duration: reduced ? 0 : first ? 1200 : user.durationMs,
      easing: first ? easeOutCubic : (t) => t,
      essential: true,
    });
    // status: as above, start following once the map exists.
  }, [user, follow, followMode, status]);

  // Guidance ended: level the map, drop the follow padding and frame the route again.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || user || !followingRef.current) return;
    followingRef.current = false;
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    const route = latest.current.routes.find((r) => r.id === latest.current.selectedId) ?? latest.current.routes[0];
    const b = route ? routeBounds([route]) : null;
    if (b) map.fitBounds(b, { padding: latest.current.padding, bearing: 0, pitch: 0, duration: prefersReducedMotion() ? 0 : 900, easing: easeOutCubic });
  }, [user]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.easeTo({ center: focusPoint.position, zoom: Math.max(map.getZoom(), 17.5), padding, duration: prefersReducedMotion() ? 0 : 700, easing: easeOutCubic });
    // Only a new key should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPoint?.key]);

  // Origin ring and destination dot, the same shapes as the logo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: Marker[] = [];
    void loadMapLibre().then((ml) => {
      if (origin) markers.push(new ml.Marker({ element: endpointMarker("origin") }).setLngLat(origin).addTo(map));
      if (destination) markers.push(new ml.Marker({ element: endpointMarker("destination") }).setLngLat(destination).addTo(map));
    });
    return () => markers.forEach((m) => m.remove());
  }, [origin, destination, styleVersion]);

  // Hazard markers are React-rendered buttons; only the selected route's hazards exist, so only they are tabbable.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !renderHazard) return;
    const markers: Marker[] = [];
    void loadMapLibre().then((ml) => {
      const els = hazards.map((hazard) => {
        const el = document.createElement("div");
        el.className = "pa-hazard-anchor";
        markers.push(new ml.Marker({ element: el }).setLngLat(hazard.location).addTo(map));
        return { hazard, el };
      });
      setHazardEls(els);
    });
    return () => {
      markers.forEach((m) => m.remove());
      setHazardEls([]);
    };
  }, [hazards, renderHazard, styleVersion]);

  const zoom = (delta: number) => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 13) + delta, { duration: prefersReducedMotion() ? 0 : 200 });
  const recenter = () => {
    const b = selectedRoute ? routeBounds([selectedRoute]) : null;
    if (b) mapRef.current?.fitBounds(b, { padding, duration: prefersReducedMotion() ? 0 : 700 });
  };

  if (!webgl) return <>{fallback}</>;

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* MapLibre forces position:relative on its container, so the wrapper owns the size. */}
      <div ref={containerRef} className="pa-map-container" data-map-status={status} />
      {/* Until the first frame is drawn: a quiet placeholder that fades out, never a blank box. */}
      <div className="pa-map-placeholder" data-hidden={status !== "loading"} aria-hidden />
      {controls && interactive && (
        <div role="group" aria-label={t("mapControls")} className="pa-map-controls">
          <button type="button" className="pa-map-button" onClick={() => zoom(1)} aria-label={t("zoomIn")}>
            <Plus aria-hidden size={20} />
          </button>
          <button type="button" className="pa-map-button" onClick={() => zoom(-1)} aria-label={t("zoomOut")}>
            <Minus aria-hidden size={20} />
          </button>
          {selectedRoute && (
            <button type="button" className="pa-map-button" onClick={recenter} aria-label={t("recenter")}>
              <Scan aria-hidden size={20} />
            </button>
          )}
          {onLocate && (
            <button
              type="button"
              className={cn("pa-map-button", locateState === "follow" && "is-active")}
              onClick={onLocate}
              aria-label={t("locate")}
              aria-pressed={locateState === "follow"}
            >
              {locateState === "off" ? <LocateFixed aria-hidden size={20} /> : <Navigation2 aria-hidden size={20} />}
            </button>
          )}
        </div>
      )}
      {onPick && (
        <div className="pa-pick-crosshair" aria-hidden>
          <Crosshair size={28} />
        </div>
      )}
      {hazardEls.map(({ hazard, el }) => createPortal(renderHazard!(hazard), el, hazard.id))}
    </div>
  );
}
