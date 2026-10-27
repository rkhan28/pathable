"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, CrosshairIcon, LocateFixedIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ApiError } from "@/api/errors";
import { coordinatePlace, parseCoordinates, searchPlaces, type Place } from "@/api/geocoding";
import { announce } from "@/features/a11y/announcer";
import { cn } from "@/lib/utils";
import { useTrip } from "./trip-store";
import { useGeolocation } from "./use-geolocation";

type Option =
  | { kind: "place"; place: Place; group: "results" | "recent" }
  | { kind: "current" }
  | { kind: "map" };

interface PlaceSearchProps {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  /** Called when the person chooses "Choose on map". */
  onPickOnMap?: () => void;
  allowCurrentLocation?: boolean;
  size?: "md" | "lg";
  hideLabel?: boolean;
  initialQuery?: string | null;
  autoFocus?: boolean;
  className?: string;
  /** Lets a parent form submit with the raw text when no suggestion is chosen. */
  onQueryChange?: (query: string) => void;
  name?: string;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Address autocomplete implementing the WAI-ARIA 1.2 combobox pattern
 * (input + listbox, aria-activedescendant). Built by hand rather than with a
 * command-menu library because async results, "use my location" and
 * "choose on map" need precise screen-reader semantics.
 */
export function PlaceSearch({
  label,
  placeholder,
  value,
  onChange,
  onPickOnMap,
  allowCurrentLocation = true,
  size = "md",
  hideLabel = false,
  initialQuery,
  autoFocus,
  className,
  onQueryChange,
  name,
}: PlaceSearchProps) {
  const t = useTranslations("search");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useTrip((s) => s.recent);
  const queryClient = useQueryClient();
  const geo = useGeolocation();

  const [query, setQuery] = useState(value?.name ?? initialQuery ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Keep the field in sync when the value changes elsewhere (swap, map pick):
  // adjust state during render rather than in an effect (no extra paint).
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setQuery(value?.name ?? "");
  }

  const debounced = useDebounced(query.trim(), 250);
  const isSelectedText = value !== null && query === value.name;
  const coords = parseCoordinates(query);
  const searching = open && !isSelectedText && !coords && debounced.length >= 3;

  const results = useQuery({
    queryKey: ["places", debounced, locale],
    queryFn: ({ signal }) => searchPlaces(debounced, locale, signal),
    enabled: searching,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const options: Option[] = useMemo(() => {
    const list: Option[] = [];
    if (allowCurrentLocation) list.push({ kind: "current" });
    if (coords) list.push({ kind: "place", group: "results", place: coordinatePlace(coords, t("pickedPoint")) });
    if (query.trim().length === 0) recent.forEach((place) => list.push({ kind: "place", place, group: "recent" }));
    if (searching && results.data) results.data.forEach((place) => list.push({ kind: "place", place, group: "results" }));
    if (onPickOnMap) list.push({ kind: "map" });
    return list;
  }, [allowCurrentLocation, coords, query, recent, searching, results.data, onPickOnMap, t]);

  // Announce result counts once a search settles.
  const resultCount = results.data?.length;
  useEffect(() => {
    if (searching && resultCount !== undefined) announce(t("suggestions", { count: resultCount }));
  }, [searching, resultCount, debounced, t]);

  /** Enter pressed before the debounced search ran: fetch now and take the top result. */
  async function chooseTopResultFor(q: string) {
    const places = await queryClient
      .fetchQuery({ queryKey: ["places", q, locale], queryFn: ({ signal }) => searchPlaces(q, locale, signal), staleTime: 5 * 60_000 })
      .catch(() => [] as Place[]);
    if (places[0]) void choose({ kind: "place", group: "results", place: places[0] });
  }

  async function choose(option: Option) {
    setOpen(false);
    setActive(-1);
    if (option.kind === "map") {
      onPickOnMap?.();
      return;
    }
    if (option.kind === "current") {
      const loc = await geo.locate();
      if (loc) {
        const place = coordinatePlace(loc, t("myLocation"), "current_location");
        onChange(place);
        announce(t("myLocation"));
      }
      return;
    }
    onChange(option.place);
    setQuery(option.place.name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && options[active]) {
        e.preventDefault();
        void choose(options[active]);
      } else if (!isSelectedText && (coords || query.trim().length >= 3)) {
        // Enter on a typed query picks the top result — the most common expectation.
        e.preventDefault();
        const first = options.find((o) => o.kind === "place");
        const settled = coords || (debounced === query.trim() && !results.isFetching);
        if (first && settled) void choose(first);
        else void chooseTopResultFor(query.trim());
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        e.preventDefault();
        setQuery("");
        onChange(null);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const activeId = open && active >= 0 ? `${id}-opt-${active}` : undefined;
  const error = results.error as ApiError | null;
  const lg = size === "lg";

  let status: React.ReactNode = null;
  if (open && !isSelectedText) {
    if (query.trim().length > 0 && query.trim().length < 3 && !coords) status = t("minChars");
    else if (searching && results.isFetching && !results.data) status = tCommon("loading");
    else if (searching && error) status = t("searchError");
    else if (searching && results.data?.length === 0) status = t("noResults", { query: debounced });
  }
  if (geo.error === "denied") status = t("locationDenied");
  else if (geo.error) status = t("locationUnavailable");

  const optionLabel = (o: Option) => {
    if (o.kind === "current") return geo.loading ? t("locating") : t("useMyLocation");
    if (o.kind === "map") return t("pickOnMap");
    return o.place.name;
  };

  let lastGroup: string | null = null;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className={cn("mb-2 block font-semibold", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <SearchIcon
          className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted", lg ? "start-5 size-6" : "start-4 size-5")}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={hintId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
            setOpen(true);
            setActive(-1);
            if (value && e.target.value !== value.name) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            // Keep open while interacting with the listbox.
            if (!e.relatedTarget?.closest(`#${CSS.escape(listId)}`)) setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full rounded-full border-2 border-input bg-surface-raised text-fg shadow-1 transition-[border-color,box-shadow] placeholder:text-fg-subtle",
            "hover:border-fg-muted focus-visible:border-focus focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-halo)]",
            lg ? "min-h-16 ps-14 pe-14 text-lg" : "min-h-12 ps-12 pe-12 text-base",
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange(null);
              onQueryChange?.("");
              inputRef.current?.focus();
            }}
            className={cn(
              "absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full text-fg-muted hover:bg-fg/6 hover:text-fg",
              lg ? "end-2.5 size-11" : "end-0.5 size-11",
            )}
            aria-label={`${t("clear")}: ${label}`}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p id={hintId} className="sr-only">
        {t("coordinatesHint")}
      </p>

      <div
        className={cn(
          "absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-4",
          !(open && (options.length > 0 || status)) && "hidden",
        )}
      >
        <ul id={listId} role="listbox" aria-label={label} className="max-h-[min(22rem,55dvh)] overflow-y-auto p-1.5 scrollbar-thin">
          {options.map((o, i) => {
            const group = o.kind === "place" ? o.group : o.kind;
            const showRecentHeading = group === "recent" && lastGroup !== "recent";
            lastGroup = group;
            const Icon = o.kind === "current" ? LocateFixedIcon : o.kind === "map" ? CrosshairIcon : o.group === "recent" ? ClockIcon : MapPinIcon;
            return (
              <li key={o.kind === "place" ? `${o.group}-${o.place.id}` : o.kind} role="presentation">
                {showRecentHeading ? (
                  <div role="presentation" className="px-3 pt-2 pb-1 text-sm font-semibold text-fg-muted">
                    {t("recent")}
                  </div>
                ) : null}
                {/* Options are not focusable by design: keyboard interaction stays on the input (aria-activedescendant). */}
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                    i === active ? "bg-accent-soft ring-2 ring-accent/60" : "hover:bg-bg-subtle",
                  )}
                >
                  <Icon className={cn("size-5 shrink-0", o.kind === "place" ? "text-fg-muted" : "text-accent")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{optionLabel(o)}</span>
                    {o.kind === "place" && o.place.context ? <span className="block truncate text-sm text-fg-muted">{o.place.context}</span> : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {status ? (
          <p className="border-t border-border px-4 py-3 text-sm text-fg-muted" role="status">
            {status}
          </p>
        ) : null}
        {searching && results.data && results.data.length > 0 ? (
          <p className="border-t border-border px-4 py-2 text-xs text-fg-subtle">{t("attribution")}</p>
        ) : null}
      </div>
      {error && !open ? <p className="sr-only">{tErrors(error.code)}</p> : null}
    </div>
  );
}
