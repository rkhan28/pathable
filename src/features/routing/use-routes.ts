"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LatLng, MobilityPreferences, RoutesResponse } from "@/api/contracts";
import type { ApiError } from "@/api/errors";
import { getService, type Bbox } from "@/api/service";

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function useRoutes(origin: LatLng | null, destination: LatLng | null, preferences: MobilityPreferences) {
  return useQuery<RoutesResponse, ApiError>({
    queryKey: ["routes", origin && [round(origin.lat), round(origin.lng)], destination && [round(destination.lat), round(destination.lng)], preferences],
    queryFn: async ({ signal }) => {
      const service = await getService();
      return service.getRoutes({ origin: origin!, destination: destination!, preferences, departAt: new Date().toISOString(), alternatives: 3 }, signal);
    },
    enabled: Boolean(origin && destination),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
  });
}

export function useNearbyHazards(bbox: Bbox | null, enabled: boolean) {
  const key = bbox?.map((n) => n.toFixed(3));
  return useQuery({
    queryKey: ["hazards", key],
    queryFn: async ({ signal }) => (await getService()).getHazards(bbox!, signal),
    enabled: enabled && bbox !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}
