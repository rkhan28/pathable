"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { CoverageResponse } from "@/lib/api/contracts";
import { getService } from "@/lib/api/select-service";

/** The area the connected service has loaded. It rarely changes, so it is asked for once a session. */
export function useCoverage() {
  return useQuery<CoverageResponse>({
    queryKey: ["coverage"],
    queryFn: async ({ signal }) => (await getService()).coverage(signal),
    staleTime: Infinity,
    retry: false,
  });
}

const KNOWN = new Set(["north-york", "corridor", "demo-trips"]);

/** The loaded area's name, for messages; null for one we have no words for. */
export function useCoverageAreaName() {
  const t = useTranslations("coverageLive.areas");
  const { data } = useCoverage();
  if (!data || !KNOWN.has(data.area)) return null;
  return { area: data.area, name: t(data.area) };
}

/**
 * The pilot is North York, but a small server may hold only the demo corridor.
 * This says which one the service behind this page actually has, from the
 * service itself, so the page never promises more than a request will get.
 */
export function LiveCoverage() {
  const t = useTranslations("coverageLive");
  const { data, isError, isPending } = useCoverage();
  if (isPending) return null;
  let text: string;
  if (isError || !data) text = t("unreachable");
  else if (data.area === "north-york") text = t("northYork", { version: data.dataVersion });
  else if (data.area === "corridor") text = t("corridor", { km2: data.areaKm2, version: data.dataVersion });
  else if (data.area === "demo-trips") text = t("demoTrips");
  else text = t("other", { area: data.area, km2: data.areaKm2, version: data.dataVersion });
  return (
    <div className="pa-notice mt-4" role="status">
      <p className="font-bold">{t("title")}</p>
      <p>{text}</p>
    </div>
  );
}
