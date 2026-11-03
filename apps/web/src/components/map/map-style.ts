import type { StyleSpecification } from "maplibre-gl";

export interface MapColors {
  land: string;
  water: string;
  park: string;
  road: string;
  roadCasing: string;
  building: string;
  label: string;
  surface: string;
  signal: string;
  barrier: string;
  unverified: string;
  unknown: string;
  casing: string;
  alt: string;
  ink: string;
}

const VARS: Record<keyof MapColors, string> = {
  land: "--map-land",
  water: "--map-water",
  park: "--map-park",
  road: "--map-road",
  roadCasing: "--map-road-casing",
  building: "--map-building",
  label: "--map-label",
  surface: "--surface",
  signal: "--signal",
  barrier: "--state-barrier",
  unverified: "--state-unverified",
  unknown: "--state-unknown",
  casing: "--route-casing",
  alt: "--route-alt",
  ink: "--ink",
};

/** Map colours come from the active theme's CSS variables, read at runtime. */
export function readMapColors(el: Element = document.documentElement): MapColors {
  const css = getComputedStyle(el);
  return Object.fromEntries(
    Object.entries(VARS).map(([k, v]) => [k, css.getPropertyValue(v).trim() || "#888888"]),
  ) as unknown as MapColors;
}

export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILES || "https://tiles.openfreemap.org/planet";
const GLYPHS = process.env.NEXT_PUBLIC_MAP_GLYPHS || "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/** A quiet basemap in the brand palette: the route is the only loud thing on it. */
export function brandStyle(c: MapColors, locale: string): StyleSpecification {
  const lang = locale.slice(0, 2);
  const name = ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]];
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { omt: { type: "vector", url: TILE_URL, attribution: "© OpenStreetMap contributors" } },
    layers: [
      { id: "land", type: "background", paint: { "background-color": c.land } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": c.park } },
      {
        id: "landcover", type: "fill", source: "omt", "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood"]]], paint: { "fill-color": c.park, "fill-opacity": 0.7 },
      },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": c.water } },
      {
        id: "building", type: "fill", source: "omt", "source-layer": "building", minzoom: 14,
        paint: { "fill-color": c.building, "fill-outline-color": c.roadCasing },
      },
      {
        id: "road-casing", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "transit", "path"]]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.roadCasing, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 12] },
      },
      {
        id: "road", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "transit", "path"]]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.road, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 9] },
      },
      {
        id: "path", type: "line", source: "omt", "source-layer": "transportation", minzoom: 14,
        filter: ["==", ["get", "class"], "path"],
        paint: { "line-color": c.roadCasing, "line-width": 1, "line-dasharray": [2, 2] },
      },
      {
        id: "rail", type: "line", source: "omt", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
        paint: { "line-color": c.label, "line-opacity": 0.35, "line-width": 1 },
      },
      {
        id: "road-label", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": name as never, "text-font": ["Noto Sans Regular"], "text-size": 12 },
        paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.5 },
      },
      {
        id: "place-label", type: "symbol", source: "omt", "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["suburb", "neighbourhood", "quarter"]]],
        layout: { "text-field": name as never, "text-font": ["Noto Sans Regular"], "text-size": 13 },
        paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.5 },
      },
    ],
  };
}

/** Used when tiles or glyphs fail: a plain background so routes still render. */
export function fallbackStyle(c: MapColors): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "land", type: "background", paint: { "background-color": c.land } }] };
}
