import type { LatLng } from "@/api/contracts";

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Coord = [lng: number, lat: number];

export const toLatLng = ([lng, lat]: Coord): LatLng => ({ lat, lng });
export const toCoord = ({ lat, lng }: LatLng): Coord => [lng, lat];

export function lineLengthMeters(coords: Coord[], from = 0, to = coords.length - 1): number {
  let total = 0;
  for (let i = from; i < to; i++) total += haversineMeters(toLatLng(coords[i]), toLatLng(coords[i + 1]));
  return total;
}

export function boundsOf(coords: Coord[]): [Coord, Coord] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Bearing in degrees (0 = north, clockwise). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point a fraction (0..1) of the way along a polyline. */
export function pointAlong(coords: Coord[], fraction: number): Coord {
  const total = lineLengthMeters(coords);
  const target = total * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const seg = haversineMeters(toLatLng(coords[i]), toLatLng(coords[i + 1]));
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
    }
    walked += seg;
  }
  return coords[coords.length - 1];
}

/** Greater Toronto Area bounding box [west, south, east, north] used to bias search. */
export const GTA_BBOX: [number, number, number, number] = [-79.64, 43.58, -79.11, 43.86];
export const TORONTO_CENTER: LatLng = { lat: 43.6532, lng: -79.3832 };

export function isInsideBbox(p: LatLng, [w, s, e, n]: [number, number, number, number]) {
  return p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n;
}

export function formatCoordinate(p: LatLng) {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}
