"use client";

import type { Map as MlMap, Marker } from "maplibre-gl";
import { Crosshair, Minus, Plus, Scan } from "lucide-react";
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
  installRouteLayers,
  routeBounds,
  setDrawProgress,
  setFlowPhase,
  setIsolation,
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
  /** Changing `key` flies the camera to `position` ("show on map"). */
  focusPoint?: { position: LonLat; key: number } | null;
  /** When set, the next map click is reported here (choose on map). */
  onPick?: ((position: LonLat) => void) | null;
  /** Rendered instead of the map when WebGL is missing. */
  fallback?: ReactNode;
  className?: string;
  onStatus?: (status: MapStatus) => void;
}

export type MapStatus = "loading" | "ready" | "fallback-style" | "no-webgl";

const noopSubscribe = () => () => {};
const DEFAULT_PADDING: Padding = { top: 48, bottom: 48, left: 48, right: 48 };
const FLOW_PERIOD_MS = 7000;

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
  fallback,
  className,
  onStatus,
}: RouteMapProps) {
  const t = useTranslations("planner");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const colorsRef = useRef<MapColors | null>(null);
  const styleFailedRef = useRef(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [styleVersion, setStyleVersion] = useState(0);
  const [hazardEls, setHazardEls] = useState<{ hazard: Hazard; el: HTMLElement }[]>([]);
  const latest = useRef({ routes, selectedId, isolatedId, padding, onPick });
  useLayoutEffect(() => {
    latest.current = { routes, selectedId, isolatedId, padding, onPick };
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
    let frame = 0;
    const start = performance.now();
    const total = duration.route * 1000;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / total);
      setDrawProgress(map, easeOutCubic(p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [routes, selectedRoute?.id, styleVersion, drawOn]);

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
    const tick = (now: number) => {
      if (now - last > 50 && document.visibilityState === "visible") {
        setFlowPhase(map, (now % FLOW_PERIOD_MS) / FLOW_PERIOD_MS, colorsRef.current?.casing ?? "#ffffff");
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flow, styleVersion, selectedRoute?.id]);

  // Camera follows the selected route and the padding (the sheet height on mobile).
  const fitKey = `${selectedRoute?.id}|${padding.top}|${padding.bottom}|${padding.left}|${padding.right}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRoute) return;
    const b = routeBounds([selectedRoute]);
    if (!b) return;
    const reduced = prefersReducedMotion();
    map.fitBounds(b, {
      padding,
      duration: reduced ? 0 : cameraDuration(distanceKm(b[0], b[1])),
      easing: easeOutCubic,
      essential: false,
    });
    // fitKey captures padding and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, styleVersion === 0]);

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
