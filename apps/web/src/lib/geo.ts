import type { LonLat } from "./api/contracts";

/** North York's bounding box (from the City boundary, docs/DATA_REPORT.md). */
export const NORTH_YORK_BBOX: [number, number, number, number] = [-79.5853, 43.6929, -79.2991, 43.8157];

export function inNorthYorkBbox([lon, lat]: LonLat): boolean {
  const [w, s, e, n] = NORTH_YORK_BBOX;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

/**
 * Parse pasted coordinates: "43.7741, -79.4996", "-79.4996 43.7741", or
 * "geo:43.7741,-79.4996". When both orders are valid, the one inside the pilot
 * area wins; otherwise latitude-first is assumed.
 */
export function parseCoordinates(text: string): LonLat | null {
  const m = /^(?:geo:)?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/i.exec(text.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const latFirst: LonLat | null = Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [b, a] : null;
  const lonFirst: LonLat | null = Math.abs(b) <= 90 && Math.abs(a) <= 180 ? [a, b] : null;
  if (lonFirst && !(latFirst && inNorthYorkBbox(latFirst)) && inNorthYorkBbox(lonFirst)) return lonFirst;
  return latFirst ?? lonFirst;
}

export function formatLonLat([lon, lat]: LonLat): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** Query-string form used in shareable links: ?from=lat,lon&to=lat,lon */
export function parseLinkParam(value: string | null): LonLat | null {
  return value ? parseCoordinates(value) : null;
}
