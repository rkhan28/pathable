"use client";

import { ArrowDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Place } from "@/api/geocoding";
import { Button } from "@/components/ui/button";
import { PlaceSearch } from "@/features/navigation/place-search";
import { useTrip } from "@/features/navigation/trip-store";
import { useRouter } from "@/i18n/navigation";

/** The hero's primary interaction: a real destination search that hands off to the planner. */
export function HeroSearch() {
  const t = useTranslations("landing");
  const router = useRouter();
  const setDestination = useTrip((s) => s.setDestination);
  const setPendingQuery = useTrip((s) => s.setPendingQuery);
  const [place, setPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState("");

  function go(selected: Place | null = place) {
    if (selected) {
      setDestination(selected);
      setPendingQuery(null);
    } else if (query.trim()) {
      setPendingQuery(query.trim());
    }
    router.push("/navigate");
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="flex w-full max-w-xl flex-col gap-4"
    >
      <PlaceSearch
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={place}
        onChange={(p) => {
          setPlace(p);
          if (p) go(p);
        }}
        onQueryChange={setQuery}
        allowCurrentLocation={false}
        size="lg"
        name="destination"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg">
          {t("primaryCta")}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href="#how-it-works">
            {t("secondaryCta")}
            <ArrowDownIcon aria-hidden="true" />
          </a>
        </Button>
      </div>
    </form>
  );
}
