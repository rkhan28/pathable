"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Hazard, LatLng, Route } from "@/api/contracts";
import { usePrefersReducedMotion } from "@/features/a11y/use-reduced-motion";
import { SEGMENT_STYLE } from "@/features/routing/status-visuals";
import { env } from "@/lib/env";
import { boundsOf, TORONTO_CENTER, toCoord, type Coord } from "@/lib/geo";
import { HazardMarker } from "./hazard-marker";

export type MapStatus = "loading" | "ready" | "tiles-error" | "webgl-error";

export interface MapViewHandle {
  zoomIn(): void;
  zoomOut(): void;
  flyTo(location: LatLng, zoom?: number): void;
  fitSelected(): void;
  focusCanvas(): void;
}

export interface MapViewProps {
  routes: Route[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  origin: LatLng | null;
  destination: LatLng | null;
  userLocation: LatLng | null;
  routeHazards: Hazard[];
  nearbyHazards: Hazard[];
  picking: boolean;
  onPick: (location: LatLng) => void;
  onStatusChange: (status: MapStatus) => void;
  onViewportChange?: (bbox: [number, number, number, number]) => void;
  /** Extra padding so fitted routes aren't hidden under overlays (bottom sheet). */
  fitPadding: { top: number; bottom: number; left: number; right: number };
}

// Served from /public (copied on install) so bundler chunk names don't break the worker URL.
setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

const SRC_ALT = "pa-alternatives";
const SRC_SEL = "pa-selected";
const SRC_SEGMENTS = "pa-segments";

/** Used when the remote style can't load (offline, blocked tiles): routes still render on a plain canvas. */
const fallbackStyle = (bg: string): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": bg } }],
});

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

const isDark = () => document.documentElement.classList.contains("dark");

function buildData(routes: Route[], selectedId: string | null) {
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const alternatives: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: routes
      .filter((r) => r.id !== selected?.id)
      .map((r) => ({ type: "Feature", properties: { id: r.id, rank: r.recommendation.rank }, geometry: r.geometry })),
  };
  const selectedLine: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: selected ? [{ type: "Feature", properties: { id: selected.id }, geometry: selected.geometry }] : [],
  };
  const segments: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: selected
      ? selected.segments.map((s) => ({
          type: "Feature",
          properties: { status: s.status },
          geometry: { type: "LineString", coordinates: selected.geometry.coordinates.slice(s.startIndex, s.endIndex + 1) },
        }))
      : [],
  };
  return { alternatives, selectedLine, segments, selected };
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
  const t = useTranslations("map");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const styleFailedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [markerHosts, setMarkerHosts] = useState<{ hazard: Hazard; el: HTMLElement; focusable: boolean }[]>([]);
  const endpointMarkers = useRef<Marker[]>([]);
  const hazardMarkers = useRef<Marker[]>([]);

  /** Adds (or refreshes) PathAble's sources and layers; safe to call after any style change. */
  const installLayers = useCallback((map: MapLibreMap) => {
    const { routes, selectedRouteId } = propsRef.current;
    const data = buildData(routes, selectedRouteId);
    const upsert = (id: string, fc: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as GeoJSONSource | undefined;
      if (src) src.setData(fc);
      else map.addSource(id, { type: "geojson", data: fc });
    };
    upsert(SRC_ALT, data.alternatives);
    upsert(SRC_SEL, data.selectedLine);
    upsert(SRC_SEGMENTS, data.segments);

    if (map.getLayer("pa-alt-line")) return;
    const beforeId = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    const casing = cssVar("--map-route-casing");
    const layout = { "line-cap": "round", "line-join": "round" } as const;

    map.addLayer({ id: "pa-alt-casing", type: "line", source: SRC_ALT, layout, paint: { "line-color": casing, "line-width": 9, "line-opacity": 0.9 } }, beforeId);
    map.addLayer(
      { id: "pa-alt-line", type: "line", source: SRC_ALT, layout: { "line-join": "round" }, paint: { "line-color": cssVar("--map-route-alt"), "line-width": 5, "line-dasharray": [2, 1.4] } },
      beforeId,
    );
    // Generous invisible hit area so alternatives are easy to tap.
    map.addLayer({ id: "pa-alt-hit", type: "line", source: SRC_ALT, layout, paint: { "line-color": "#000", "line-width": 26, "line-opacity": 0 } }, beforeId);
    map.addLayer({ id: "pa-sel-casing", type: "line", source: SRC_SEL, layout, paint: { "line-color": casing, "line-width": 13 } }, beforeId);
    for (const status of ["verified_accessible", "unknown", "reported_unverified", "known_barrier"] as const) {
      const s = SEGMENT_STYLE[status];
      map.addLayer(
        {
          id: `pa-seg-${status}`,
          type: "line",
          source: SRC_SEGMENTS,
          filter: ["==", ["get", "status"], status],
          layout: s.dash ? { "line-cap": "round", "line-join": "round" } : layout,
          paint: {
            "line-color": cssVar(s.cssVar),
            "line-width": 8,
            ...(s.dash ? { "line-dasharray": s.dash } : {}),
          },
        },
        beforeId,
      );
    }
    map.addLayer(
      { id: "pa-seg-barrier-stripe", type: "line", source: SRC_SEGMENTS, filter: ["==", ["get", "status"], "known_barrier"], layout, paint: { "line-color": casing, "line-width": 2.2 } },
      beforeId,
    );

    map.on("click", "pa-alt-hit", (e) => {
      if (propsRef.current.picking) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") propsRef.current.onSelectRoute(id);
    });
    map.on("mouseenter", "pa-alt-hit", () => {
      if (!propsRef.current.picking) map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "pa-alt-hit", () => {
      map.getCanvas().style.cursor = propsRef.current.picking ? "crosshair" : "";
    });
  }, []);

  const recolor = useCallback((map: MapLibreMap) => {
    if (!map.getLayer("pa-alt-line")) return;
    const casing = cssVar("--map-route-casing");
    map.setPaintProperty("pa-alt-casing", "line-color", casing);
    map.setPaintProperty("pa-sel-casing", "line-color", casing);
    map.setPaintProperty("pa-seg-barrier-stripe", "line-color", casing);
    map.setPaintProperty("pa-alt-line", "line-color", cssVar("--map-route-alt"));
    for (const status of ["verified_accessible", "unknown", "reported_unverified", "known_barrier"] as const) {
      map.setPaintProperty(`pa-seg-${status}`, "line-color", cssVar(SEGMENT_STYLE[status].cssVar));
    }
  }, []);

  /** Warm the basemap toward PathAble's palette where the style uses standard layer ids. */
  const tintBasemap = useCallback((map: MapLibreMap) => {
    if (styleFailedRef.current) return;
    try {
      if (map.getLayer("background") && !isDark()) map.setPaintProperty("background", "background-color", "#f6f2e8");
      if (map.getLayer("water") && !isDark()) map.setPaintProperty("water", "fill-color", "#cfe0dc");
    } catch {
      /* style without these layers — leave as is */
    }
  }, []);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: isDark() ? env.mapStyleDark : env.mapStyleLight,
        center: toCoord(propsRef.current.origin ?? propsRef.current.destination ?? TORONTO_CENTER),
        zoom: 14,
        maxZoom: 19,
        minZoom: 9,
        attributionControl: { compact: true },
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        reduceMotion: reduced,
        locale: {
          "NavigationControl.ZoomIn": t("zoomIn"),
          "NavigationControl.ZoomOut": t("zoomOut"),
        },
      });
    } catch (error) {
      console.warn("[PathAble map] could not initialise", error);
      propsRef.current.onStatusChange("webgl-error");
      return;
    }
    mapRef.current = map;
    propsRef.current.onStatusChange("loading");

    const canvas = map.getCanvas();
    canvas.setAttribute("aria-label", t("label"));
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-roledescription", "map");

    const fallback = () => {
      if (styleFailedRef.current) return;
      styleFailedRef.current = true;
      propsRef.current.onStatusChange("tiles-error");
      map.setStyle(fallbackStyle(cssVar("--bg-subtle")));
    };
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) fallback();
    }, 12_000);

    map.on("style.load", () => {
      installLayers(map);
      tintBasemap(map);
      setMapReady(true);
      if (!styleFailedRef.current) propsRef.current.onStatusChange("ready");
    });
    let tileErrors = 0;
    map.on("error", (e) => {
      if (!map.isStyleLoaded()) fallback();
      else if (++tileErrors === 3 && !styleFailedRef.current) propsRef.current.onStatusChange("tiles-error");
      if (process.env.NODE_ENV !== "production") console.warn("[PathAble map]", e.error?.message);
    });
    map.on("click", (e) => {
      if (propsRef.current.picking) propsRef.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    const reportViewport = () => {
      const b = map.getBounds();
      propsRef.current.onViewportChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on("moveend", reportViewport);
    map.once("load", reportViewport);
    const onContextLost = () => propsRef.current.onStatusChange("webgl-error");
    canvas.addEventListener("webglcontextlost", onContextLost);

    // Follow theme / contrast changes.
    let wasDark = isDark();
    const observer = new MutationObserver(() => {
      const dark = isDark();
      if (dark !== wasDark && !styleFailedRef.current) {
        wasDark = dark;
        map.setStyle(dark ? env.mapStyleDark : env.mapStyleLight, { diff: false });
      } else {
        recolor(map);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-contrast"] });

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      // map.remove() deliberately loses the WebGL context; that isn't an error.
      canvas.removeEventListener("webglcontextlost", onContextLost);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Map is created once; later prop changes are synced by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync route data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    installLayers(map);
  }, [props.routes, props.selectedRouteId, mapReady, installLayers]);

  // Cursor for picking mode.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = props.picking ? "crosshair" : "";
  }, [props.picking]);

  // Origin / destination / user markers (decorative — the panel carries the same information).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    endpointMarkers.current.forEach((m) => m.remove());
    endpointMarkers.current = [];
    const make = (className: string, at: LatLng) => {
      const el = document.createElement("div");
      el.className = className;
      el.setAttribute("aria-hidden", "true");
      endpointMarkers.current.push(new Marker({ element: el }).setLngLat(toCoord(at)).addTo(map));
    };
    if (props.origin) make("pa-marker-origin", props.origin);
    if (props.destination) make("pa-marker-destination", props.destination);
    if (props.userLocation) make("pa-marker-user", props.userLocation);
  }, [props.origin, props.destination, props.userLocation, mapReady]);

  // Hazard markers, rendered by React through portals so they can be real buttons with popovers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    hazardMarkers.current.forEach((m) => m.remove());
    hazardMarkers.current = [];
    const routeIds = new Set(props.routeHazards.map((h) => h.id));
    const all = [...props.routeHazards, ...props.nearbyHazards.filter((h) => !routeIds.has(h.id))];
    const hosts = all.map((hazard) => {
      const el = document.createElement("div");
      el.className = "pa-hazard-host";
      hazardMarkers.current.push(new Marker({ element: el }).setLngLat(toCoord(hazard.location)).addTo(map));
      return { hazard, el, focusable: routeIds.has(hazard.id) };
    });
    setMarkerHosts(hosts);
  }, [props.routeHazards, props.nearbyHazards, mapReady]);

  const fitSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { routes, selectedRouteId, origin, destination, fitPadding } = propsRef.current;
    const route = routes.find((r) => r.id === selectedRouteId);
    const coords: Coord[] = route ? (route.geometry.coordinates as Coord[]) : ([origin, destination].filter(Boolean) as LatLng[]).map(toCoord);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.easeTo({ center: coords[0], zoom: 15, padding: fitPadding, duration: reduced ? 0 : 600 });
      return;
    }
    const [sw, ne] = boundsOf(coords);
    map.fitBounds(new LngLatBounds(sw, ne), { padding: fitPadding, maxZoom: 17, duration: reduced ? 0 : 700 });
  }, [reduced]);

  // Fit whenever the trip or selection changes.
  const fitKey = `${props.origin?.lat},${props.origin?.lng}|${props.destination?.lat},${props.destination?.lng}|${props.selectedRouteId}`;
  useEffect(() => {
    if (mapReady) fitSelected();
  }, [fitKey, mapReady, fitSelected]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn({ duration: reduced ? 0 : 250 }),
      zoomOut: () => mapRef.current?.zoomOut({ duration: reduced ? 0 : 250 }),
      flyTo: (location, zoom = 17) => mapRef.current?.easeTo({ center: toCoord(location), zoom, duration: reduced ? 0 : 700 }),
      fitSelected,
      focusCanvas: () => mapRef.current?.getCanvas().focus(),
    }),
    [fitSelected, reduced],
  );

  return (
    <>
      {/* maplibre's CSS forces position:relative on its container, so the sizing lives on a wrapper. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" lang={locale} data-testid="map" />
      </div>
      {markerHosts.map(({ hazard, el, focusable }) => createPortal(<HazardMarker hazard={hazard} focusable={focusable} />, el, hazard.id))}
    </>
  );
});
