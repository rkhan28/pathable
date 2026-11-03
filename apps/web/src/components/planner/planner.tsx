"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ChevronsLeft, ChevronsRight, Footprints, Link2, SlidersHorizontal, TrainFront, WifiOff } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { CoveragePatterns } from "@/components/route/coverage-bar";
import { RouteCard } from "@/components/route/route-card";
import { RouteDetails } from "@/components/route/route-details";
import { TransitCard } from "@/components/route/transit-card";
import { Navigation } from "@/components/navigate/navigation";
import { navCamera } from "@/components/navigate/nav-camera";
import { useTrack } from "@/components/navigate/use-track";
import { MODE_ICON } from "@/components/navigate/maneuver-icon";
import { ProfilePicker } from "@/components/settings/profile-picker";
import { FixtureBanner } from "@/components/site/fixture-banner";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { CommandPalette } from "@/components/palette/command-palette";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { LonLat, RouteResponse, TransitResponse } from "@/lib/api/contracts";
import { PathAbleError } from "@/lib/api/errors";
import { getService, serviceKind } from "@/lib/api/select-service";
import { announce } from "@/lib/announce";
import { formatLonLat, parseLinkParam } from "@/lib/geo";
import { type Journey, fromRoute, fromTransit } from "@/lib/journey";
import { spring } from "@/lib/motion";
import { usePreferences } from "@/stores/preferences";
import { useTrip, type Place } from "@/stores/trip";
import { BottomSheet } from "./bottom-sheet";
import { PlaceSearch } from "./place-search";
import { useDemoTrips } from "./use-demo-trips";
import { NearbyReports } from "./nearby-reports";
import { WhereTheyDiffer } from "./where-they-differ";
import type { Padding, RouteMapProps } from "@/components/map/route-map";
import { HazardMarker } from "@/components/map/hazard-marker";
import type { Hazard } from "@/lib/api/contracts";

const renderHazard = (h: Hazard) => <HazardMarker hazard={h} />;
const NO_HAZARDS: Hazard[] = [];
const followBreak = () => navCamera.set({ follow: false });

/** Suggest transit when it saves real time: at least 5 minutes and a fifth of the walk. */
const SUGGEST_SAVES_S = 5 * 60;

/**
 * The sheet reports its height on every animation frame. Keeping it in React
 * state re-rendered the whole planner each frame; this tiny store lets only
 * the map, which needs it for padding, subscribe.
 */
const sheetHeight = (() => {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (px: number) => {
      value = px;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
})();

function PlannerMap({ desktop, collapsed, navigating, ...props }: Omit<RouteMapProps, "padding"> & { desktop: boolean; collapsed: boolean; navigating: boolean }) {
  const t = useTranslations("planner");
  const height = useSyncExternalStore(sheetHeight.subscribe, sheetHeight.get, () => 0);
  const camera = useSyncExternalStore(navCamera.subscribe, navCamera.get, navCamera.get);
  const track = useTrack({ denied: t("locationDenied"), unavailable: t("locationUnavailable") });
  const padding = useMemo<Padding>(
    () =>
      desktop
        ? { top: 64, bottom: 64, left: collapsed ? 64 : 432, right: 96 }
        : { top: 72, bottom: Math.max(height, 136) + 24, left: 32, right: 72 },
    [desktop, collapsed, height],
  );
  if (navigating) return <RouteMap {...props} padding={padding} user={camera.user} follow={camera.follow} onFollowBreak={followBreak} controls={false} />;
  return (
    <RouteMap
      {...props}
      padding={padding}
      user={track.user}
      follow={track.state === "follow"}
      followMode="track"
      onFollowBreak={track.release}
      onLocate={track.press}
      locateState={track.state}
    />
  );
}

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
  const [mode, setMode] = useState<"walk" | "transit">("walk");
  const [transitId, setTransitId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<Journey | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [picking, setPicking] = useState<null | "origin" | "destination">(null);
  const [focusPoint, setFocusPoint] = useState<{ position: LonLat; key: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Counts sheet settles so the map re-fits once the sheet stops moving.
  const [settles, setSettles] = useState(0);
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
  // After 4 s, say why it is slow instead of leaving a spinner to speak for itself.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!query.isPending || !request) return;
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
    // Restart the timer for each new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isPending, JSON.stringify(request)]);
  const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

  // Transit is asked for alongside walking routes, so the switch can say at once whether it is faster.
  const transitQuery = useQuery<TransitResponse, PathAbleError>({
    queryKey: ["transit", request],
    queryFn: async ({ signal }) => (await getService()).transit(request!, signal),
    enabled: Boolean(request),
    staleTime: 60_000,
    retry: false,
  });
  const options = useMemo(() => transitQuery.data?.options ?? [], [transitQuery.data]);
  const journeys = useMemo(() => new Map(options.map((o) => [o.id, fromTransit(o)])), [options]);
  const fastestTransit = options.reduce<(typeof options)[number] | null>((a, o) => (!a || o.durationS < a.durationS ? o : a), null);
  const selectedTransit = options.find((o) => o.id === transitId) ?? options[0] ?? null;
  const transitJourney = selectedTransit ? journeys.get(selectedTransit.id)! : null;
  const showTransit = mode === "transit" && transitJourney !== null;
  const walkS = selected?.durationS ?? 0;
  const transitSaves = fastestTransit ? walkS - fastestTransit.durationS : 0;
  const suggestTransit = fastestTransit && transitSaves >= SUGGEST_SAVES_S && transitSaves >= walkS / 5 ? fastestTransit : null;
  const suggestedRide = suggestTransit?.legs.find((l) => l.kind === "ride");

  const startWalk = useCallback(
    (id: string) => {
      const route = routes.find((r) => r.id === id);
      if (route) setNavigating(fromRoute(route));
    },
    [routes],
  );
  const startTransit = useCallback((id: string) => {
    const j = journeys.get(id);
    if (j) setNavigating(j);
  }, [journeys]);

  // Off route on foot: plan again from where the person is now, to the same place.
  const reroute = useCallback(
    async (from: LonLat) => {
      if (!destination || rerouting) return;
      setRerouting(true);
      try {
        const res = await (await getService()).routes({ origin: from, destination: destination.position, preferences });
        if (res.routes[0]) setNavigating(fromRoute(res.routes[0]));
      } catch {
        // Keep guiding along the old line; the banner says we are still off it.
      } finally {
        setRerouting(false);
      }
    },
    [destination, preferences, rerouting],
  );
  const fixture = query.data?.source === "development-fixture";

  useEffect(() => {
    if (query.data && !query.isPlaceholderData) announce(t("planner.updated", { count: query.data.routes.length }));
    // Announce once per fresh result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isPlaceholderData]);

  useEffect(() => {
    if (view === "list") headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  const openDetails = useCallback(
    (id: string) => {
      select(id);
      setView("details");
    },
    [select],
  );

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


  const errorMessage = (e: PathAbleError) =>
    e.code === "no_route" && kind === "development-fixture" ? t("errors.no_route_fixture") : t(`errors.${e.code}`);

  const panel = (
    <div className="pa-panel">
      {view === "details" && selected ? (
        <RouteDetails
          route={selected}
          onBack={() => setView("list")}
          onShowOnMap={(p) => setFocusPoint({ position: p, key: Date.now() })}
          onStartGuidance={() => startWalk(selected.id)}
          total={routes.length}
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
            <ProfilePicker compact />
            <Link href="/settings#mobility" className="pa-chip-button" aria-label={t("planner.editPreferences")}>
              <SlidersHorizontal aria-hidden size={16} />
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
            <>
              {slow && (
                <div className="pa-waking mt-6" role="status">
                  <p>{t("planner.waking")}</p>
                  <div className="pa-indeterminate" aria-hidden />
                </div>
              )}
              <ul className="mt-6 grid gap-3" aria-busy="true" aria-label={t("common.loading")}>
                {[0, 1, 2].map((i) => (
                  <li key={i} className="pa-skeleton-card" />
                ))}
              </ul>
            </>
          )}

          {routes.length > 0 && (
            <div className="pa-modes mt-5" role="radiogroup" aria-label={t("transit.modes")}>
              {(["walk", "transit"] as const).map((m) => {
                const Icon = m === "walk" ? Footprints : TrainFront;
                const s = m === "walk" ? selected?.durationS : fastestTransit?.durationS;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    className="pa-mode"
                    onClick={() => setMode(m)}
                    onKeyDown={(e) => {
                      // A radio group: arrow keys move between the two modes.
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                      e.preventDefault();
                      const next = m === "walk" ? "transit" : "walk";
                      setMode(next);
                      (e.currentTarget.parentElement?.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus();
                    }}
                    data-mode={m}
                  >
                    {active && <motion.span layoutId="pa-mode-pill" className="pa-mode-pill" transition={spring.ui} />}
                    <Icon aria-hidden size={18} />
                    <span>{t(`transit.${m}`)}</span>
                    <span className="pa-mode-time">
                      {s !== undefined ? t("common.minutes", { value: Math.max(1, Math.round(s / 60)) }) : m === "transit" && transitQuery.isPending ? <span className="pa-dots" aria-label={t("transit.loading")} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <AnimatePresence initial={false}>
            {mode === "walk" && suggestTransit && suggestedRide?.kind === "ride" && (
              <motion.button
                type="button"
                className="pa-suggest mt-3"
                onClick={() => {
                  setTransitId(suggestTransit.id);
                  setMode("transit");
                }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring.ui}
              >
                {(() => {
                  const Icon = MODE_ICON[suggestedRide.mode];
                  return <Icon aria-hidden size={18} />;
                })()}
                {t("transit.suggest", { mode: suggestedRide.mode, line: suggestedRide.line, minutes: t("common.minutes", { value: Math.round(transitSaves / 60) }) })}
              </motion.button>
            )}
          </AnimatePresence>

          {routes.length > 0 && mode === "transit" && (
            <section aria-labelledby="transit-title" className="mt-4">
              <h2 id="transit-title" className="sr-only">{t("transit.options")}</h2>
              {transitQuery.isPending && (
                <ul className="grid gap-3" aria-busy="true" aria-label={t("transit.loading")}>
                  {[0, 1].map((i) => (
                    <li key={i} className="pa-skeleton-card is-short" />
                  ))}
                </ul>
              )}
              {transitQuery.isError && <p className="pa-notice">{t("transit.unavailable")}</p>}
              {transitQuery.data && options.length === 0 && <p className="pa-notice">{t("transit.none")}</p>}
              {options.length > 0 && (
                <fieldset className="border-0 p-0">
                  <legend className="sr-only">{t("transit.options")}</legend>
                  <ul className="grid gap-3">
                    {options.map((o) => (
                      <TransitCard
                        key={o.id}
                        option={o}
                        name={`${radioName}-transit`}
                        selected={o.id === selectedTransit?.id}
                        fixture={transitQuery.data?.source === "development-fixture"}
                        fastest={options.length > 1 && o.id === fastestTransit?.id}
                        onSelect={setTransitId}
                        onStart={startTransit}
                      />
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-ink-muted">{t("transit.scheduled")}</p>
                </fieldset>
              )}
            </section>
          )}

          {routes.length > 0 && mode === "walk" && (
            <section aria-labelledby="routes-title" className="mt-4">
              <h2 id="routes-title" className="sr-only">
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
                        name={radioName}
                        selected={r.id === selected?.id}
                        fixture={fixture}
                        onSelect={select}
                        onIsolate={setIsolated}
                        onDetails={openDetails}
                        onStart={startWalk}
                      />
                    ))}
                  </ul>
                </LayoutGroup>
              </fieldset>
              <WhereTheyDiffer routes={routes} onShow={(p) => setFocusPoint({ position: p, key: Date.now() })} />
              {selected && <NearbyReports route={selected} onShow={(p) => setFocusPoint({ position: p, key: Date.now() })} />}
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
        <PlannerMap
          desktop={desktop}
          collapsed={collapsed}
          navigating={navigating !== null}
          routes={navigating ? [navigating] : showTransit ? [transitJourney] : routes}
          rides={navigating ? navigating.rides.map((r) => r.leg) : showTransit ? transitJourney.rides.map((r) => r.leg) : undefined}
          selectedId={navigating ? navigating.id : showTransit ? transitJourney.id : (selected?.id ?? null)}
          isolatedId={isolated}
          origin={origin?.position}
          destination={destination?.position}
          fitTrigger={desktop ? `d-${collapsed}` : `m-${settles}`}
          label={t("landing.heroMapLabel")}
          focusPoint={focusPoint}
          hazards={selected?.hazards ?? NO_HAZARDS}
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

      {navigating ? null : desktop ? (
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
        <BottomSheet initialSnap="half" onVisibleHeight={sheetHeight.set} onSettled={() => setSettles((n) => n + 1)} label={t("planner.title")}>
          {panel}
        </BottomSheet>
      )}

      {navigating && <Navigation journey={navigating} onExit={() => setNavigating(null)} onReroute={reroute} rerouting={rerouting} />}
    </div>
  );
}
