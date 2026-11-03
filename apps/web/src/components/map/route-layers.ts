import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import type { KnowledgeState, LonLat, Route, Segment } from "@/lib/api/contracts";
import type { MapColors } from "./map-style";

/**
 * Route rendering. Knowledge state is encoded by colour AND pattern on the
 * selected route:
 *   verified   solid, signal emerald
 *   barrier    solid red with a light centre stripe
 *   unverified dashed amber
 *   unknown    dotted grey (round caps)
 * Alternatives are thin, quiet lines; hovering or focusing a card isolates one.
 */

/** The subset of a route the map needs; the landing hero sends only this. */
export type MapRoute = Pick<Route, "id" | "geometry"> & { segments: Pick<Segment, "from" | "to" | "lengthM" | "state">[] };

export const SOURCES = { segments: "pa-segments", alternatives: "pa-alternatives", flow: "pa-flow" } as const;
const L = {
  altCasing: "pa-alt-casing",
  alt: "pa-alt",
  casing: "pa-sel-casing",
  verified: "pa-sel-verified",
  barrier: "pa-sel-barrier",
  barrierStripe: "pa-sel-barrier-stripe",
  unverified: "pa-sel-unverified",
  unknown: "pa-sel-unknown",
  flow: "pa-sel-flow",
} as const;

type Feature = GeoJSON.Feature<GeoJSON.LineString, { routeId: string; state: KnowledgeState; start: number; end: number }>;

function slice(geometry: LonLat[], from: number, to: number): LonLat[] {
  const part = geometry.slice(from, to + 1);
  return part.length >= 2 ? part : [geometry[from], geometry[Math.min(from + 1, geometry.length - 1)]];
}

/** Segment features with their fractional position along the route, for draw-on. */
export function segmentFeatures(route: MapRoute): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const total = route.segments.reduce((a, s) => a + s.lengthM, 0) || 1;
  let along = 0;
  const features: Feature[] = route.segments.map((s) => {
    const start = along / total;
    along += s.lengthM;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: slice(route.geometry, s.from, s.to) },
      properties: { routeId: route.id, state: s.state, start, end: along / total },
    };
  });
  return { type: "FeatureCollection", features };
}

export function alternativeFeatures(routes: MapRoute[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: routes.map((r) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: r.geometry },
      properties: { routeId: r.id },
    })),
  };
}

const lineLayout = { "line-cap": "round", "line-join": "round" } as const;
const width = (base: number) => ["interpolate", ["linear"], ["zoom"], 11, base * 0.5, 15, base, 18, base * 1.6] as never;

/** Install sources and layers. Safe to call again after a style swap. */
/** False once the map is removed or between style swaps; animations must not touch it then. */
function alive(map: MlMap): boolean {
  return Boolean((map as unknown as { style?: unknown }).style) && Boolean(map.getLayer("pa-sel-casing"));
}

export function installRouteLayers(map: MlMap, c: MapColors): void {
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  for (const id of Object.values(SOURCES)) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty, lineMetrics: id === SOURCES.flow });
  }
  const add = (layer: Parameters<MlMap["addLayer"]>[0]) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  };
  add({ id: L.altCasing, type: "line", source: SOURCES.alternatives, layout: lineLayout, paint: { "line-color": c.casing, "line-width": width(7) } });
  add({ id: L.alt, type: "line", source: SOURCES.alternatives, layout: lineLayout, paint: { "line-color": c.alt, "line-width": width(4), "line-opacity": 0.9 } });
  add({ id: L.casing, type: "line", source: SOURCES.segments, layout: lineLayout, paint: { "line-color": c.casing, "line-width": width(11) } });
  add({
    id: L.verified, type: "line", source: SOURCES.segments, layout: lineLayout,
    filter: ["==", ["get", "state"], "verified"], paint: { "line-color": c.signal, "line-width": width(7) },
  });
  add({
    id: L.barrier, type: "line", source: SOURCES.segments, layout: lineLayout,
    filter: ["==", ["get", "state"], "barrier"], paint: { "line-color": c.barrier, "line-width": width(7) },
  });
  add({
    id: L.barrierStripe, type: "line", source: SOURCES.segments, layout: lineLayout,
    filter: ["==", ["get", "state"], "barrier"], paint: { "line-color": c.casing, "line-width": width(2) },
  });
  add({
    id: L.unverified, type: "line", source: SOURCES.segments, layout: { "line-join": "round", "line-cap": "butt" },
    filter: ["==", ["get", "state"], "unverified"], paint: { "line-color": c.unverified, "line-width": width(7), "line-dasharray": [1.6, 1] },
  });
  add({
    id: L.unknown, type: "line", source: SOURCES.segments, layout: lineLayout,
    filter: ["==", ["get", "state"], "unknown"], paint: { "line-color": c.unknown, "line-width": width(6), "line-dasharray": [0, 1.7] },
  });
  add({
    id: L.flow, type: "line", source: SOURCES.flow, layout: lineLayout,
    paint: { "line-width": width(3), "line-gradient": flowGradient(0, c.casing) as never, "line-opacity": 0.55 },
  });
}

export function setRoutes(map: MlMap, routes: MapRoute[], selectedId: string | null): void {
  if (!alive(map)) return;
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];
  const others = routes.filter((r) => r !== selected);
  (map.getSource(SOURCES.alternatives) as GeoJSONSource | undefined)?.setData(alternativeFeatures(others));
  (map.getSource(SOURCES.segments) as GeoJSONSource | undefined)?.setData(
    selected ? segmentFeatures(selected) : { type: "FeatureCollection", features: [] },
  );
  (map.getSource(SOURCES.flow) as GeoJSONSource | undefined)?.setData(
    selected
      ? { type: "Feature", geometry: { type: "LineString", coordinates: selected.geometry }, properties: {} }
      : { type: "FeatureCollection", features: [] },
  );
}

const SELECTED_LAYERS = [L.casing, L.verified, L.barrier, L.barrierStripe, L.unverified, L.unknown];

/** Reveal the selected route up to fraction p (0–1) of its length. */
export function setDrawProgress(map: MlMap, p: number): void {
  if (!alive(map)) return;
  const filter = (state?: KnowledgeState) =>
    (state ? ["all", ["==", ["get", "state"], state], ["<=", ["get", "start"], p]] : ["<=", ["get", "start"], p]) as never;
  map.setFilter(L.casing, filter());
  map.setFilter(L.verified, filter("verified"));
  map.setFilter(L.barrier, filter("barrier"));
  map.setFilter(L.barrierStripe, filter("barrier"));
  map.setFilter(L.unverified, filter("unverified"));
  map.setFilter(L.unknown, filter("unknown"));
  map.setLayoutProperty(L.flow, "visibility", p >= 1 ? "visible" : "none");
}

/** Hovering or focusing a card isolates that route by dimming everything else. */
export function setIsolation(map: MlMap, isolatedId: string | null, selectedId: string | null): void {
  if (!alive(map)) return;
  const dimSelected = isolatedId !== null && isolatedId !== selectedId;
  for (const id of SELECTED_LAYERS) map.setPaintProperty(id, "line-opacity", dimSelected ? 0.25 : 1);
  map.setPaintProperty(L.alt, "line-opacity", isolatedId === null ? 0.9 : ["case", ["==", ["get", "routeId"], isolatedId], 1, 0.15] as never);
  map.setPaintProperty(L.alt, "line-width", isolatedId && isolatedId !== selectedId ? (["case", ["==", ["get", "routeId"], isolatedId], 7, 4] as never) : width(4));
}

/** A light band travelling along the selected route: slow, subtle, off under reduced motion. */
export function flowGradient(phase: number, light: string): unknown[] {
  const band = 0.06;
  const p = ((phase % 1) + 1) % 1;
  const clear = "rgba(0,0,0,0)";
  const wanted: [number, string][] = [
    [0, clear],
    [p - band, clear],
    [p, light],
    [p + band, clear],
    [1, clear],
  ];
  // line-gradient stops must be strictly ascending inside [0, 1].
  const stops: [number, string][] = [];
  for (const [pos, colour] of wanted) {
    const at = Math.min(1, Math.max(0, pos));
    if (stops.length === 0 || at - stops[stops.length - 1][0] > 1e-4) stops.push([at, colour]);
  }
  if (stops[stops.length - 1][0] < 1) stops.push([1, clear]);
  return ["interpolate", ["linear"], ["line-progress"], ...stops.flat()];
}

export function setFlowPhase(map: MlMap, phase: number, light: string): void {
  if (alive(map) && map.getLayer(L.flow)) map.setPaintProperty(L.flow, "line-gradient", flowGradient(phase, light) as never);
}

export function routeBounds(routes: Pick<Route, "geometry">[]): [[number, number], [number, number]] | null {
  const pts = routes.flatMap((r) => r.geometry);
  if (!pts.length) return null;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [[minX, minY], [maxX, maxY]];
}
