import { z } from "zod";
import type { LonLat } from "./api/contracts";
import { NORTH_YORK_BBOX, inNorthYorkBbox } from "./geo";

const GEOCODER = process.env.NEXT_PUBLIC_GEOCODER_URL || "https://photon.komoot.io";

const PhotonResponse = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z
        .object({
          name: z.string().optional(),
          housenumber: z.string().optional(),
          street: z.string().optional(),
          district: z.string().optional(),
          city: z.string().optional(),
          osm_id: z.number().optional(),
        })
        .passthrough(),
    }),
  ),
});

export interface PlaceResult {
  id: string;
  label: string;
  detail: string;
  position: LonLat;
}

/** Photon geocoder limited to North York; responses are validated like any other. */
export async function searchPlaces(query: string, lang: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const url = new URL("/api", GEOCODER);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("bbox", NORTH_YORK_BBOX.join(","));
  url.searchParams.set("lang", ["en", "fr", "de"].includes(lang) ? lang : "en");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const parsed = PhotonResponse.safeParse(await res.json());
  if (!parsed.success) throw new Error("geocoder contract mismatch");
  const seen = new Set<string>();
  return parsed.data.features
    .filter((f) => inNorthYorkBbox(f.geometry.coordinates))
    .map((f, i) => {
      const p = f.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(" ");
      const label = p.name ?? (street || query);
      return {
        id: `${p.osm_id ?? i}-${i}`,
        label,
        detail: [p.name ? street : null, p.district ?? p.city].filter(Boolean).join(", "),
        position: f.geometry.coordinates,
      };
    })
    // A long street comes back once per OSM segment; show each place once.
    .filter((r) => {
      const key = `${r.label}|${r.detail}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
