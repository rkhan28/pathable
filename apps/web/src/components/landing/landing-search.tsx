"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatLonLat } from "@/lib/geo";
import { useDemoTrips } from "@/components/planner/use-demo-trips";
import { PlaceSearch } from "@/components/planner/place-search";
import { useTrip } from "@/stores/trip";

/** The hero's working search: choosing a place opens the planner with it as the destination. */
export function LandingSearch() {
  const t = useTranslations("landing");
  const router = useRouter();
  const demoTrips = useDemoTrips();
  return (
    <PlaceSearch
      label={t("searchLabel")}
      value={null}
      demoTrips={demoTrips}
      onDemoTrip={(trip) =>
        router.push({ pathname: "/navigate", query: { from: formatLonLat(trip.origin.position), to: formatLonLat(trip.destination.position) } })
      }
      onSelect={(place) => {
        // The link only carries coordinates, so hand the planner the place's name through the
        // trip store too; it keeps a stored place whose position matches the link.
        useTrip.getState().setDestination(place);
        router.push({ pathname: "/navigate", query: { to: formatLonLat(place.position) } });
      }}
      className="pa-hero-search"
    />
  );
}
