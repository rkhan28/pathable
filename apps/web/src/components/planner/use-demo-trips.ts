"use client";

import { useMemo } from "react";
import { FIXTURE_TRIPS_PUBLIC } from "@/lib/api/fixture-trips";
import { serviceKind } from "@/lib/api/select-service";
import type { DemoTrip } from "./place-search";

/** Demo trips are offered only when development fixtures are the data source. */
export function useDemoTrips(): DemoTrip[] {
  return useMemo(
    () =>
      serviceKind() === "development-fixture"
        ? FIXTURE_TRIPS_PUBLIC.map((t) => ({
            id: t.id,
            label: `${t.originName} – ${t.destinationName}`,
            origin: { label: t.originName, position: t.origin },
            destination: { label: t.destinationName, position: t.destination },
          }))
        : [],
    [],
  );
}
