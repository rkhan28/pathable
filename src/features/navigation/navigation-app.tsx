"use client";

import { ArrowDownUpIcon, ChevronLeftIcon, ChevronRightIcon, CrosshairIcon, LinkIcon, SlidersHorizontalIcon, WifiOffIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { LatLng } from "@/api/contracts";
import type { ApiError } from "@/api/errors";
import { coordinatePlace, reverseGeocode } from "@/api/geocoding";
import type { Bbox } from "@/api/service";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, Spinner } from "@/components/ui/feedback";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Skeleton } from "@/components/ui/misc";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { announce } from "@/features/a11y/announcer";
import { HazardDetails } from "@/features/hazards/hazard-details";
import { MapControls } from "@/features/map/map-controls";
import type { MapStatus, MapViewHandle } from "@/features/map/map-view";
import { PreferencesForm } from "@/features/preferences/preferences-form";
import { usePreferences, usePreferencesHydrated } from "@/features/preferences/store";
import { GuidanceView } from "@/features/routing/guidance-view";
import { RouteCard } from "@/features/routing/route-card";
import { RouteDetails } from "@/features/routing/route-details";
import { RouteExplanation } from "@/features/routing/route-explanation";
import { SEGMENT_ORDER, SegmentSwatch } from "@/features/routing/status-visuals";
import { useNearbyHazards, useRoutes } from "@/features/routing/use-routes";
import { Link } from "@/i18n/navigation";
import { getBackendMode } from "@/lib/env";
import { formatDistance, formatDuration } from "@/lib/format";
import { useMediaQuery, useOnline } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { BackendNotice } from "./backend-notice";
import { PlaceSearch } from "./place-search";
import { useTrip, useTripHydrated } from "./trip-store";
import { useGeolocation } from "./use-geolocation";

const MapView = dynamic(() => import("@/features/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" />,
});

type View = "plan" | "details" | "guidance";
type Snap = "peek" | "half" | "full";
const SNAP_ORDER: Snap[] = ["peek", "half", "full"];

function parsePoint(value: string | null): LatLng | null {
  if (!value) return null;
  const [lat, lng] = value.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function NavigationApp() {
  const t = useTranslations("navigate");
  const tSearch = useTranslations("search");
  const tRoutes = useTranslations("routes");
  const tMap = useTranslations("map");
  const tErrors = useTranslations("errors");
  const tProfiles = useTranslations("profiles");
  const tHaz = useTranslations("hazards");
  const tCommon = useTranslations("common");
  const tPrefs = useTranslations("preferences");
  const tOnboarding = useTranslations("onboarding");
  const tLandingProfiles = useTranslations("landing.profiles");
  const locale = useLocale();
  const mode = getBackendMode();
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const online = useOnline();
  const prefsHydrated = usePreferencesHydrated();
  const tripHydrated = useTripHydrated();

  const { origin, destination, selectedRouteId, pendingQuery, setOrigin, setDestination, swap, selectRoute, setPendingQuery } = useTrip();
  const mobility = usePreferences((s) => s.mobility);
  const onboarding = usePreferences((s) => s.onboarding);

  const [view, setView] = useState<View>("plan");
  const [snap, setSnap] = useState<Snap>("half");
  const [collapsed, setCollapsed] = useState(false);
  const [picking, setPicking] = useState<"origin" | "destination" | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [showNearby, setShowNearby] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [initialQuery] = useState(() => pendingQuery);
  const mapRef = useRef<MapViewHandle>(null);
  const panelRef = useRef<HTMLElement>(null);
  const geo = useGeolocation();

  // Apply ?from=lat,lng&to=lat,lng links once the session store has loaded.
  const appliedUrl = useRef(false);
  useEffect(() => {
    if (!tripHydrated || appliedUrl.current) return;
    appliedUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const from = parsePoint(params.get("from"));
    const to = parsePoint(params.get("to"));
    if (from) setOrigin(coordinatePlace(from, params.get("fromName") ?? tSearch("pickedPoint")));
    if (to) setDestination(coordinatePlace(to, params.get("toName") ?? tSearch("pickedPoint")));
    if (pendingQuery) setPendingQuery(null);
  }, [tripHydrated, pendingQuery, setOrigin, setDestination, setPendingQuery, tSearch]);

  const routesQuery = useRoutes(prefsHydrated ? (origin?.location ?? null) : null, destination?.location ?? null, mobility);
  const response = routesQuery.data;
  const routes = useMemo(() => (origin && destination ? (response?.routes ?? []) : []), [response, origin, destination]);
  const sample = response?.source === "development-fixture" || mode === "fixtures";
  const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;
  const nearby = useNearbyHazards(bbox, showNearby && mode !== "unavailable");

  // Announce new results once per response.
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (!response || response.requestId === lastAnnounced.current || routes.length === 0) return;
    lastAnnounced.current = response.requestId;
    const best = routes[0];
    announce(
      t("foundAnnouncement", {
        count: routes.length,
        distance: formatDistance(best.summary.distanceMeters, locale),
        duration: formatDuration(best.summary.durationSeconds, locale, "long"),
      }),
    );
  }, [response, routes, t, locale]);

  const onSelectRoute = useCallback(
    (id: string) => {
      selectRoute(id);
      const r = routes.find((x) => x.id === id);
      if (r) {
        announce(
          t("selectedAnnouncement", {
            rank: r.recommendation.rank,
            distance: formatDistance(r.summary.distanceMeters, locale),
            duration: formatDuration(r.summary.durationSeconds, locale, "long"),
            barriers: tRoutes("barriers", { count: r.summary.knownBarrierCount }),
          }),
        );
      }
    },
    [routes, selectRoute, t, tRoutes, locale],
  );

  // Escape cancels map picking.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const startPicking = (target: "origin" | "destination") => {
    setPicking(target);
    if (!desktop) setSnap("peek");
    announce(tSearch("pickingOnMap"));
    mapRef.current?.focusCanvas();
  };

  const onPick = useCallback(
    async (location: LatLng) => {
      const target = picking;
      setPicking(null);
      if (!target) return;
      const provisional = coordinatePlace(location, tSearch("pickedPoint"));
      (target === "origin" ? setOrigin : setDestination)(provisional);
      if (!desktop) setSnap("half");
      const named = await reverseGeocode(location, locale);
      if (named) (target === "origin" ? setOrigin : setDestination)({ ...named, kind: "coordinates" });
    },
    [picking, setOrigin, setDestination, tSearch, locale, desktop],
  );

  const locateMe = async () => {
    const loc = await geo.locate();
    if (loc) {
      setUserLocation(loc);
      mapRef.current?.flyTo(loc, 16);
      if (!origin) setOrigin(coordinatePlace(loc, tSearch("myLocation"), "current_location"));
    } else {
      toast(tSearch(geo.error === "denied" ? "locationDenied" : "locationUnavailable"));
    }
  };

  const copyLink = async () => {
    if (!origin || !destination) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("from", `${origin.location.lat.toFixed(5)},${origin.location.lng.toFixed(5)}`);
    url.searchParams.set("to", `${destination.location.lat.toFixed(5)},${destination.location.lng.toFixed(5)}`);
    url.searchParams.set("fromName", origin.name);
    url.searchParams.set("toName", destination.name);
    await navigator.clipboard?.writeText(url.toString()).catch(() => undefined);
    toast.success(t("shared"));
  };

  const showDetails = () => {
    setView("details");
    if (!desktop) setSnap("full");
    requestAnimationFrame(() => document.getElementById("route-details-title")?.focus());
  };

  const sheetHeight = { peek: "9.5rem", half: "52dvh", full: "calc(100dvh - 5rem)" }[snap];
  const fitPadding = useMemo(
    () => (desktop ? { top: 72, bottom: 72, left: 72, right: 96 } : { top: 72, bottom: snap === "peek" ? 170 : Math.round((typeof window === "undefined" ? 800 : window.innerHeight) * 0.52) + 24, left: 32, right: 72 }),
    [desktop, snap],
  );

  // Pointer drag on the sheet handle; buttons provide the same control for keyboard / switch users.
  const drag = useRef<{ startY: number; startSnap: Snap } | null>(null);
  const onHandlePointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startSnap: snap };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const i = SNAP_ORDER.indexOf(drag.current.startSnap);
    if (Math.abs(dy) > 40) setSnap(SNAP_ORDER[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)))]);
    else setSnap(SNAP_ORDER[(i + 1) % 3]);
    drag.current = null;
  };

  const routeError = routesQuery.error as ApiError | null;
  const nearbyHazards = showNearby ? (nearby.data?.hazards ?? []) : [];

  /* ------------------------------------------------------------------ panel */
  const planView = (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        aria-label={t("panelLabel")}
        onSubmit={(e) => e.preventDefault()}
        className="relative flex flex-col gap-3"
      >
        <PlaceSearch
          label={tSearch("from")}
          placeholder={tSearch("fromPlaceholder")}
          value={origin}
          onChange={setOrigin}
          onPickOnMap={() => startPicking("origin")}
        />
        <PlaceSearch
          label={tSearch("to")}
          placeholder={tSearch("toPlaceholder")}
          value={destination}
          onChange={setDestination}
          onPickOnMap={() => startPicking("destination")}
          initialQuery={!destination ? initialQuery : null}
          autoFocus={Boolean(initialQuery) && !destination}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute end-0 -top-1.5"
          onClick={() => {
            swap();
            announce(tSearch("swap"));
          }}
          aria-label={tSearch("swap")}
          disabled={!origin && !destination}
        >
          <ArrowDownUpIcon aria-hidden="true" />
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-subtle px-3 py-2">
        <p className="text-sm">
          {t("profileLine", { profile: tProfiles(`${mobility.profile}.name`) })}
          {mobility.maxSlopePercent !== null ? <span className="text-fg-muted">{`, ${tPrefs("maxSlopeValue", { value: mobility.maxSlopePercent })}`}</span> : null}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setPrefsOpen(true)}>
          <SlidersHorizontalIcon aria-hidden="true" />
          {t("changePreferences")}
        </Button>
      </div>

      {onboarding === "pending" && prefsHydrated ? (
        <Callout tone="info" title={tOnboarding("title")}>
          <Link href="/onboarding" className="font-semibold text-fg underline underline-offset-2">
            {tLandingProfiles("cta")}
          </Link>
        </Callout>
      ) : null}

      <BackendNotice mode={mode} />
      {!online ? (
        <Callout tone="warning" icon={WifiOffIcon} role="status">
          {t("offline")}
        </Callout>
      ) : null}

      <section aria-labelledby="routes-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="routes-heading" className="text-title font-semibold">
            {routes.length ? t("found", { count: routes.length }) : t("emptyTitle")}
          </h2>
          {routes.length ? (
            <Button variant="ghost" size="icon-sm" onClick={copyLink} aria-label={t("share")}>
              <LinkIcon aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {!origin || !destination ? (
          <EmptyState icon={CrosshairIcon} title={t("emptyTitle")} className="rounded-lg border border-dashed border-border-strong py-8">
            {t("emptyBody")}
          </EmptyState>
        ) : routesQuery.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Spinner label={t("finding")} className="text-fg-muted" />
            <p className="text-fg-muted" aria-hidden="true">
              {t("finding")}
            </p>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : routeError ? (
          <Callout
            tone={routeError.code === "backend_not_configured" ? "info" : "danger"}
            role="alert"
            title={routeError.code === "no_route_found" ? tRoutes("noRoutesTitle") : tErrors(routeError.code)}
            action={
              routeError.retryable ? (
                <Button variant="secondary" size="sm" onClick={() => routesQuery.refetch()}>
                  {tCommon("retry")}
                </Button>
              ) : null
            }
          >
            {routeError.code === "no_route_found" ? tRoutes("noRoutesBody") : null}
          </Callout>
        ) : routes.length === 0 ? (
          <Callout tone="neutral" title={tRoutes("noRoutesTitle")}>
            {tRoutes("noRoutesBody")}
          </Callout>
        ) : (
          <>
            {routesQuery.isFetching ? <Spinner label={t("finding")} className="text-fg-muted" /> : null}
            <div role="radiogroup" aria-label={tRoutes("listLabel")} className="flex flex-col gap-3">
              {routes.map((r) => (
                <RouteCard
                  key={r.id}
                  route={r}
                  name={tRoutes("option", { rank: r.recommendation.rank })}
                  selected={selected?.id === r.id}
                  onSelect={() => onSelectRoute(r.id)}
                  onDetails={showDetails}
                  sample={sample}
                />
              ))}
            </div>
            {selected ? <RouteExplanation routes={routes} routeId={selected.id} /> : null}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">{tRoutes("legend")}</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {SEGMENT_ORDER.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <SegmentSwatch status={s} width={30} />
                    {tRoutes(`segments.${s}`)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-muted">{tRoutes("legendNote")}</p>
            </div>
          </>
        )}
      </section>

      {nearbyHazards.length > 0 ? (
        <Accordion type="single" collapsible className="border-t border-border">
          <AccordionItem value="nearby" className="border-b-0">
            <AccordionTrigger className="text-base">
              {tHaz("nearby")} <span className="ms-auto me-2 text-sm font-normal text-fg-muted">{tHaz("nearbyCount", { count: nearbyHazards.length })}</span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col gap-3">
                {nearbyHazards.slice(0, 30).map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                    <HazardDetails hazard={h} headingLevel={4} />
                    <Button variant="ghost" size="icon-sm" aria-label={`${tRoutes("details.showOnMap")}: ${tHaz(`types.${h.type}`)}`} onClick={() => mapRef.current?.flyTo(h.location)}>
                      <CrosshairIcon aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );

  const panelContent =
    view === "guidance" && selected ? (
      <GuidanceView route={selected} sample={sample} onExit={() => setView("details")} onStep={(loc) => mapRef.current?.flyTo(loc, 18)} />
    ) : view === "details" && selected ? (
      <RouteDetails
        route={selected}
        sample={sample}
        onBack={() => {
          setView("plan");
          if (!desktop) setSnap("half");
        }}
        onShowOnMap={(loc) => {
          mapRef.current?.flyTo(loc);
          if (!desktop) setSnap("peek");
        }}
        onStartGuidance={() => {
          setView("guidance");
          if (!desktop) setSnap("half");
        }}
      />
    ) : (
      planView
    );

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] min-h-0 shrink-0 overflow-hidden lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      {/* Panel: sidebar on desktop, bottom sheet on mobile — one DOM tree, no duplicated content. */}
      <aside
        ref={panelRef}
        id="route-panel"
        aria-label={t("sheetLabel")}
        className={cn(
          "z-20 flex flex-col bg-surface",
          "max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-[1.75rem] max-lg:border-t max-lg:border-border max-lg:shadow-4 max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out-soft",
          "lg:relative lg:h-full lg:border-e lg:border-border",
          collapsed ? "lg:w-0 lg:overflow-hidden lg:border-e-0" : "lg:w-[27rem]",
        )}
        style={desktop ? undefined : { height: sheetHeight }}
      >
        <div className="flex items-center justify-center gap-2 pt-2 lg:hidden">
          <button
            type="button"
            onPointerDown={onHandlePointerDown}
            onPointerUp={onHandlePointerUp}
            className="flex min-h-11 w-24 touch-none items-center justify-center"
            aria-label={snap === "full" ? t("sheetPeek") : t("sheetFull")}
            aria-expanded={snap !== "peek"}
            aria-controls="route-panel-content"
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") setSnap(SNAP_ORDER[Math.min(2, SNAP_ORDER.indexOf(snap) + 1)]);
              if (e.key === "ArrowDown") setSnap(SNAP_ORDER[Math.max(0, SNAP_ORDER.indexOf(snap) - 1)]);
            }}
          >
            <span className="h-1.5 w-12 rounded-full bg-border-strong" aria-hidden="true" />
          </button>
        </div>
        <div id="route-panel-content" className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin lg:px-6 lg:pt-6", collapsed && "lg:hidden")}>
          <h1 className="sr-only">{t("title")}</h1>
          {panelContent}
        </div>
      </aside>

      {/* Map */}
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:h-full">
        {mapStatus === "webgl-error" ? (
          <div className="grid h-full place-items-center bg-bg-subtle p-8">
            <Callout tone="info" title={tMap("webglError")} className="max-w-md" />
          </div>
        ) : (
          <MapView
            ref={mapRef}
            routes={routes}
            selectedRouteId={selected?.id ?? null}
            onSelectRoute={onSelectRoute}
            origin={origin?.location ?? null}
            destination={destination?.location ?? null}
            userLocation={userLocation}
            routeHazards={selected?.hazards ?? []}
            nearbyHazards={nearbyHazards}
            picking={picking !== null}
            onPick={onPick}
            onStatusChange={setMapStatus}
            onViewportChange={setBbox}
            fitPadding={fitPadding}
          />
        )}

        {desktop ? (
          <Button
            variant="secondary"
            size="icon"
            className="absolute start-3 top-3 z-10 shadow-3"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls="route-panel"
            aria-label={collapsed ? t("expand") : t("collapse")}
          >
            {collapsed ? <ChevronRightIcon className="rtl:rotate-180" aria-hidden="true" /> : <ChevronLeftIcon className="rtl:rotate-180" aria-hidden="true" />}
          </Button>
        ) : null}

        {picking ? (
          <div role="status" className="absolute inset-x-3 top-3 z-10 mx-auto flex max-w-md items-center gap-3 rounded-full bg-fg py-2 ps-5 pe-2 text-fg-inverse shadow-4 lg:start-20">
            <CrosshairIcon className="size-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-sm font-medium">{tSearch("pickingOnMap")}</span>
            <Button size="sm" variant="secondary" onClick={() => setPicking(null)}>
              {tCommon("cancel")}
            </Button>
          </div>
        ) : null}

        {mapStatus === "tiles-error" ? (
          <p role="status" className="absolute start-3 bottom-3 z-10 max-w-sm rounded-lg bg-surface-raised/95 p-3 text-sm shadow-3 max-lg:top-3 max-lg:bottom-auto max-lg:end-16 lg:start-20">
            {tMap("tilesError")}
          </p>
        ) : null}

        <MapControls
          className="absolute end-3 top-3 z-10"
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onLocate={locateMe}
          locating={geo.loading}
          onFit={() => mapRef.current?.fitSelected()}
          canFit={Boolean(origin || destination)}
          showHazards={showNearby}
          onToggleHazards={() => setShowNearby((s) => !s)}
        />
      </div>

      <Sheet open={prefsOpen} onOpenChange={setPrefsOpen}>
        <SheetContent side={desktop ? "end" : "bottom"} closeLabel={tCommon("close")} className="overflow-y-auto lg:w-[30rem]">
          <SheetTitle>{tPrefs("title")}</SheetTitle>
          <SheetDescription>{tPrefs("intro")}</SheetDescription>
          <PreferencesForm showNotes={false} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
