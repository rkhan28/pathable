/**
 * Address search via a Photon-compatible geocoder (OpenStreetMap data, ODbL).
 * Photon explicitly supports search-as-you-type, unlike Nominatim's public
 * instance. Self-host or point NEXT_PUBLIC_GEOCODER_URL at a commercial
 * Photon provider for production traffic.
 */
import { z } from "zod";
import type { LatLng } from "./contracts";
import { ApiError, toApiError } from "./errors";
import { env } from "@/lib/env";
import { GTA_BBOX, TORONTO_CENTER } from "@/lib/geo";

export interface Place {
  id: string;
  /** Primary line, e.g. "Union Station" or "100 Queen Street West". */
  name: string;
  /** Secondary line, e.g. "Downtown, Toronto". */
  context: string | null;
  location: LatLng;
  kind: "address" | "place" | "street" | "area" | "coordinates" | "current_location";
}

const PhotonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z
    .object({
      osm_id: z.number().optional(),
      osm_type: z.string().optional(),
      name: z.string().optional(),
      housenumber: z.string().optional(),
      street: z.string().optional(),
      district: z.string().optional(),
      locality: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      type: z.string().optional(),
    })
    .loose(),
});
const PhotonResponse = z.object({ features: z.array(PhotonFeature) });

function toPlace(feature: z.infer<typeof PhotonFeature>): Place {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const streetLine = p.street ? [p.housenumber, p.street].filter(Boolean).join(" ") : null;
  const name = p.name ?? streetLine ?? p.city ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const contextParts = [p.name && streetLine ? streetLine : null, p.district ?? p.locality, p.city].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i && v !== name,
  );
  const kind: Place["kind"] = p.housenumber ? "address" : p.type === "street" ? "street" : p.type === "city" || p.type === "district" ? "area" : "place";
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? `${lat},${lng}`}`,
    name,
    context: contextParts.length ? contextParts.join(", ") : null,
    location: { lat, lng },
    kind,
  };
}

const photonLang = (locale: string) => (locale.startsWith("fr") ? "fr" : "en");

export async function searchPlaces(query: string, locale: string, signal?: AbortSignal, near: LatLng = TORONTO_CENTER): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL("/api/", env.geocoderUrl);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", photonLang(locale));
  url.searchParams.set("bbox", GTA_BBOX.join(","));
  url.searchParams.set("lat", String(near.lat));
  url.searchParams.set("lon", String(near.lng));
  try {
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
    if (!res.ok) throw new ApiError(res.status === 429 ? "rate_limited" : "unavailable", `Geocoder HTTP ${res.status}`, { status: res.status });
    const parsed = PhotonResponse.safeParse(await res.json());
    if (!parsed.success) throw new ApiError("contract_mismatch", "Unexpected geocoder response");
    const seen = new Set<string>();
    return parsed.data.features.map(toPlace).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  } catch (error) {
    throw toApiError(error);
  }
}

export async function reverseGeocode(location: LatLng, locale: string, signal?: AbortSignal): Promise<Place | null> {
  const url = new URL("/reverse", env.geocoderUrl);
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lon", String(location.lng));
  url.searchParams.set("lang", photonLang(locale));
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const parsed = PhotonResponse.safeParse(await res.json());
    const feature = parsed.success ? parsed.data.features[0] : undefined;
    return feature ? { ...toPlace(feature), location } : null;
  } catch {
    return null;
  }
}

export function coordinatePlace(location: LatLng, name: string, kind: Place["kind"] = "coordinates"): Place {
  return {
    id: `pt:${location.lat.toFixed(5)},${location.lng.toFixed(5)}`,
    name,
    context: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
    location,
    kind,
  };
}

/** Accepts "43.6453, -79.3806" style input so people can paste coordinates. */
export function parseCoordinates(input: string): LatLng | null {
  const m = input.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
