"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ChevronsLeft, ChevronsRight, Link2, SlidersHorizontal, WifiOff } from "lucide-react";
import { LayoutGroup } from "motion/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { CoveragePatterns } from "@/components/route/coverage-bar";
import { Guidance } from "@/components/route/guidance";
import { RouteCard } from "@/components/route/route-card";
import { RouteDetails } from "@/components/route/route-details";
import { FixtureBanner } from "@/components/site/fixture-banner";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { CommandPalette } from "@/components/palette/command-palette";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { LonLat, RouteResponse } from "@/lib/api/contracts";
import { PathAbleError } from "@/lib/api/errors";
import { getService, serviceKind } from "@/lib/api/select-service";
import { announce } from "@/lib/announce";
import { formatLonLat, parseLinkParam } from "@/lib/geo";
import { usePreferences } from "@/stores/preferences";
import { useTrip, type Place } from "@/stores/trip";
import { BottomSheet, type Snap } from "./bottom-sheet";
import { PlaceSearch } from "./place-search";
import { useDemoTrips } from "./use-demo-trips";
import { WhereTheyDiffer } from "./where-they-differ";
import type { Padding } from "@/components/map/route-map";
import { HazardMarker } from "@/components/map/hazard-marker";
import type { Hazard } from "@/lib/api/contracts";

const renderHazard = (h: Hazard) => <HazardMarker hazard={h} />;

const RouteMap = dynamic(() => import("@/components/map/route-map").then((m) => m.RouteMap), { ssr: false });

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const q = matchMedia("(min-width: 64rem)");
    const update = () => setDesktop(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return desktop;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function Planner() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const desktop = useIsDesktop();
  const online = useOnline();
  const demoTrips = useDemoTrips();
  const radioName = useId();
  const { origin, destination, selectedRouteId, setOrigin, setDestination, swap, select } = useTrip();
  const preferences = usePreferences((s) => s.preferences);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "details">("list");
  const [guidance, setGuidance] = useState(false);
  const [picking, setPicking] = useState<null | "origin" | "destination">(null);
  const [focusPoint, setFocusPoint] = useState<{ position: LonLat; key: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [snap, setSnap] = useState<Snap>("half");
  const [sheetHeight, setSheetHeight] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const kind = serviceKind();

  // Shareable links: ?from=lat,lon&to=lat,lon seed the trip on first load.
  // Wait for the session store to rehydrate first, and leave an identical trip
  // alone, so a language switch keeps the selected route.
  const seeded = useRef(false);
  useEffect(() => {
    const same = (a: LonLat | undefined, b: LonLat) => Boolean(a) && a![0].toFixed(5) === b[0].toFixed(5) && a![1].toFixed(5) === b[1].toFixed(5);
    const seed = () => {
      if (seeded.current) return;
      seeded.current = true;
      const from = parseLinkParam(params.get("from"));
      const to = parseLinkParam(params.get("to"));
      const current = useTrip.getState();
      const trip = demoTrips.find((d) => from && to && same(d.origin.position, from) && same(d.destination.position, to));
      const label = (p: LonLat) => t("search.coordinates", { lat: p[1].toFixed(5), lon: p[0].toFixed(5) });
      if (from && !same(current.origin?.position, from)) setOrigin(trip?.origin ?? { label: label(from), position: from });
      if (to && !same(current.destination?.position, to)) setDestination(trip?.destination ?? { label: label(to), position: to });
    };
    if (useTrip.persist.hasHydrated()) seed();
    else return useTrip.persist.onFinishHydration(seed);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in step with the trip so it can be shared.
  useEffect(() => {
    if (!seeded.current) return;
    const query: Record<string, string> = {};
    if (origin) query.from = formatLonLat(origin.position);
    if (destination) query.to = formatLonLat(destination.position);
    router.replace({ pathname, query }, { scroll: false });
    // pathname and router are stable for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.position[0], origin?.position[1], destination?.position[0], destination?.position[1]]);

  const request = origin && destination ? { origin: origin.position, destination: destination.position, preferences } : null;
  const query = useQuery<RouteResponse, PathAbleError>({
    queryKey: ["routes", request],
    queryFn: async ({ signal }) => (await getService()).routes(request!, signal),
    enabled: Boolean(request),
    // Keep showing the previous routes while preferences change.
    placeholderData: keepPreviousData,
  });
  const routes = useMemo(() => query.data?.routes ?? [], [query.data]);
  const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;
  const fixture = query.data?.source === "development-fixture";

  useEffect(() => {
    if (query.data && !query.isPlaceholderData) announce(t("planner.updated", { count: query.data.routes.length }));
    // Announce once per fresh result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isPlaceholderData]);

  useEffect(() => {
    if (view === "list") headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  const choose = useCallback(
    (which: "origin" | "destination", place: Place) => (which === "origin" ? setOrigin(place) : setDestination(place)),
    [setOrigin, setDestination],
  );

  // Escape cancels choose-on-map.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    toast(t("planner.shared"));
  };

  const padding: Padding = desktop
    ? { top: 64, bottom: 64, left: collapsed ? 64 : 432, right: 96 }
    : { top: 72, bottom: Math.max(sheetHeight, 136) + 24, left: 32, right: 72 };

  const errorMessage = (e: PathAbleError) =>
    e.code === "no_route" && kind === "development-fixture" ? t("errors.no_route_fixture") : t(`errors.${e.code}`);

  const panel = (
    <div className="pa-panel">
      {view === "details" && selected ? (
        <RouteDetails
          route={selected}
          onBack={() => setView("list")}
          onShowOnMap={(p) => setFocusPoint({ position: p, key: Date.now() })}
          onStartGuidance={() => setGuidance(true)}
        />
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            {t("planner.title")}
          </h1>
          <div className="pa-trip-fields">
            <PlaceSearch
              label={t("planner.from")}
              value={origin}
              onSelect={(p) => choose("origin", p)}
              onChooseOnMap={() => setPicking("origin")}
              demoTrips={demoTrips}
              onDemoTrip={(trip) => {
                setOrigin(trip.origin);
                setDestination(trip.destination);
              }}
              placeholder={t("search.placeholder")}
            />
            <button type="button" className="pa-swap" onClick={swap} aria-label={t("planner.swap")} disabled={!origin && !destination}>
              <ArrowUpDown aria-hidden size={18} />
            </button>
            <PlaceSearch
              label={t("planner.to")}
              value={destination}
              onSelect={(p) => choose("destination", p)}
              onChooseOnMap={() => setPicking("destination")}
              demoTrips={demoTrips}
              onDemoTrip={(trip) => {
                setOrigin(trip.origin);
                setDestination(trip.destination);
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!desktop && <LanguageSwitcher />}
            <Link href="/settings#mobility" className="pa-chip-button">
              <SlidersHorizontal aria-hidden size={16} />
              {t("planner.editPreferences")}
            </Link>
            {request && (
              <button type="button" className="pa-chip-button" onClick={share}>
                <Link2 aria-hidden size={16} />
                {t("planner.share")}
              </button>
            )}
          </div>

          {fixture && <FixtureBanner generatedAt={query.data?.generatedAt} className="mt-4" />}
          {!online && (
            <p className="pa-notice mt-4" role="status">
              <WifiOff aria-hidden size={18} />
              {t("planner.offline")}
            </p>
          )}

          {!request && (
            <div className="pa-empty mt-6">
              <p>{t("planner.empty")}</p>
              {demoTrips.length > 0 && (
                <>
                  <p className="mt-3 font-bold">{t("planner.emptyDemo")}</p>
                  <ul className="mt-2 grid gap-2">
                    {demoTrips.map((trip) => (
                      <li key={trip.id}>
                        <button
                          type="button"
                          className="pa-link-button w-full justify-start"
                          onClick={() => {
                            setOrigin(trip.origin);
                            setDestination(trip.destination);
                          }}
                        >
                          {trip.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {query.isError && (
            <div className="pa-notice is-error mt-4" role="alert">
              <p>{errorMessage(query.error)}</p>
              {query.error.retryable && (
                <button type="button" className="pa-chip-button mt-2" onClick={() => query.refetch()}>
                  {t("common.retry")}
                </button>
              )}
              {query.error.code === "no_route" && kind === "development-fixture" && (
                <ul className="mt-2 grid gap-2">
                  {demoTrips.map((trip) => (
                    <li key={trip.id}>
                      <button type="button" className="pa-text-link" onClick={() => { setOrigin(trip.origin); setDestination(trip.destination); }}>
                        {trip.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {request && query.isPending && (
            <ul className="mt-6 grid gap-3" aria-busy="true" aria-label={t("common.loading")}>
              {[0, 1, 2].map((i) => (
                <li key={i} className="pa-skeleton-card" />
              ))}
            </ul>
          )}

          {routes.length > 0 && (
            <section aria-labelledby="routes-title" className="mt-6">
              <h2 id="routes-title" className="text-md font-bold">
                {t("planner.routes")}
              </h2>
              {routes.every((r) => r.compatibility === "incompatible") && (
                <p className="pa-notice mt-3">{t("planner.noneCompatible")}</p>
              )}
              <fieldset className="mt-3 border-0 p-0" aria-describedby={undefined}>
                <legend className="sr-only">{t("planner.routes")}</legend>
                <LayoutGroup>
                  <ul className="grid gap-3" aria-busy={query.isFetching}>
                    {routes.map((r) => (
                      <RouteCard
                        key={r.id}
                        route={r}
                        total={routes.length}
                        name={radioName}
                        selected={r.id === selected?.id}
                        fixture={fixture}
                        onSelect={() => select(r.id)}
                        onIsolate={(on) => setIsolated(on ? r.id : null)}
                        onDetails={() => {
                          select(r.id);
                          setView("details");
                        }}
                      />
                    ))}
                  </ul>
                </LayoutGroup>
              </fieldset>
              <WhereTheyDiffer routes={routes} onShow={(p) => setFocusPoint({ position: p, key: Date.now() })} />
              <section aria-labelledby="reports-title" className="mt-6">
                <h3 id="reports-title" className="font-bold">
                  {t("planner.nearbyReports")}
                </h3>
                <p className="mt-1 text-ink-muted">{t("planner.noReports")}</p>
              </section>
            </section>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="pa-planner">
      <CoveragePatterns />
      <CommandPalette />
      <div id="map" className="pa-planner-map">
        <RouteMap
          routes={routes}
          selectedId={selected?.id ?? null}
          isolatedId={isolated}
          origin={origin?.position}
          destination={destination?.position}
          padding={padding}
          label={t("landing.heroMapLabel")}
          focusPoint={focusPoint}
          hazards={selected?.hazards ?? []}
          renderHazard={renderHazard}
          onPick={
            picking
              ? (p) => {
                  choose(picking, { label: t("search.coordinates", { lat: p[1].toFixed(5), lon: p[0].toFixed(5) }), position: p });
                  setPicking(null);
                }
              : null
          }
          fallback={<p className="p-6">{t("landing.heroFallback")}</p>}
        />
        {picking && (
          <p className="pa-pick-hint" role="status">
            {t("planner.pickOnMap", { which: picking === "origin" ? t("planner.from") : t("planner.to") })}
          </p>
        )}
      </div>

      {desktop ? (
        <aside className={collapsed ? "pa-sidebar is-collapsed" : "pa-sidebar"} aria-label={t("planner.title")}>
          <div className="flex items-center gap-2 px-4 pt-3 [&>a]:me-auto">
            {!collapsed && (
              <>
                <Link href="/" aria-label={t("nav.home")} className="pa-logo-link">
                  <Wordmark />
                </Link>
                <LanguageSwitcher />
              </>
            )}
            <button type="button" className="pa-icon-button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? t("planner.expandSidebar") : t("planner.collapseSidebar")}>
              {collapsed ? <ChevronsRight aria-hidden size={20} className="rtl:rotate-180" /> : <ChevronsLeft aria-hidden size={20} className="rtl:rotate-180" />}
            </button>
          </div>
          {!collapsed && panel}
        </aside>
      ) : (
        <BottomSheet snap={snap} onSnapChange={setSnap} onVisibleHeight={setSheetHeight} label={t("planner.title")}>
          {panel}
        </BottomSheet>
      )}

      {selected && guidance && <Guidance key={selected.id} route={selected} open onOpenChange={setGuidance} onStep={(i) => setFocusPoint({ position: selected.geometry[selected.steps[i].at], key: Date.now() })} />}
    </div>
  );
}
