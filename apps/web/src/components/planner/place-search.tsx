"use client";

import { Clock, Crosshair, LocateFixed, MapPin, Route as RouteIcon, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { announce } from "@/lib/announce";
import { cn } from "@/lib/cn";
import { inNorthYorkBbox, parseCoordinates } from "@/lib/geo";
import { searchPlaces, type PlaceResult } from "@/lib/geocoding";
import type { Place } from "@/stores/trip";

export interface DemoTrip {
  id: string;
  label: string;
  origin: Place;
  destination: Place;
}

interface Option {
  id: string;
  group: "actions" | "demo" | "recent" | "results";
  label: string;
  detail?: string;
  icon: ReactNode;
  run: () => void;
}

const RECENT_KEY = "pathable:recent-places";
const MAX_RECENT = 5;

/** Recent places stay in this tab only (sessionStorage), like the trip itself. */
function readRecent(): Place[] {
  try {
    return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(place: Place) {
  const next = [place, ...readRecent().filter((p) => p.label !== place.label)].slice(0, MAX_RECENT);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/**
 * WAI-ARIA 1.2 combobox with a listbox popup. Typing searches North York;
 * pasted coordinates resolve directly; actions offer the current location and
 * choosing on the map. Focus stays in the input; options are announced through
 * aria-activedescendant.
 */
export function PlaceSearch({
  label,
  value,
  onSelect,
  onChooseOnMap,
  demoTrips = [],
  onDemoTrip,
  placeholder,
  autoFocus,
  className,
  hideLabel = false,
}: {
  label: string;
  value: Place | null;
  onSelect: (place: Place) => void;
  onChooseOnMap?: () => void;
  demoTrips?: DemoTrip[];
  onDemoTrip?: (trip: DemoTrip) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  hideLabel?: boolean;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<Place[]>([]);

  // Follow the selected place when it changes from outside (swap, demo trip, shared link).
  const [shownLabel, setShownLabel] = useState(value?.label);
  if (value?.label !== shownLabel) {
    setShownLabel(value?.label);
    setText(value?.label ?? "");
  }

  const query = text.trim();
  const coords = parseCoordinates(query);
  const searchable = open && query.length >= 3 && !coords && query !== value?.label;
  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(query, locale.slice(0, 2), controller.signal);
        setResults(found);
        announce(found.length ? t("results", { count: found.length }) : t("noResults"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // coords is derived from query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchable, locale]);
  const visibleResults = searchable ? results : [];

  const choose = (place: Place) => {
    if (!inNorthYorkBbox(place.position)) {
      setMessage(t("outsideCoverage"));
      announce(t("outsideCoverage"), "assertive");
      return;
    }
    pushRecent(place);
    setText(place.label);
    setOpen(false);
    setActive(-1);
    setMessage(null);
    onSelect(place);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setMessage(t("locationDenied"));
      return;
    }
    setMessage(t("locating"));
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ label: t("useLocation"), position: [pos.coords.longitude, pos.coords.latitude] }),
      () => {
        setMessage(t("locationDenied"));
        announce(t("locationDenied"), "assertive");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const options: Option[] = useMemo(() => {
    const list: Option[] = [];
    if (coords) {
      const label = t("coordinates", { lat: coords[1].toFixed(5), lon: coords[0].toFixed(5) });
      list.push({ id: "coords", group: "results", label, icon: <MapPin aria-hidden size={18} />, run: () => choose({ label, position: coords }) });
    }
    for (const r of visibleResults) {
      list.push({ id: `r-${r.id}`, group: "results", label: r.label, detail: r.detail, icon: <MapPin aria-hidden size={18} />, run: () => choose({ label: r.label, position: r.position }) });
    }
    if (!query || !list.length) {
      list.push({ id: "locate", group: "actions", label: t("useLocation"), icon: <LocateFixed aria-hidden size={18} />, run: locate });
      if (onChooseOnMap) {
        list.push({
          id: "map",
          group: "actions",
          label: t("chooseOnMap"),
          icon: <Crosshair aria-hidden size={18} />,
          run: () => {
            setOpen(false);
            onChooseOnMap();
          },
        });
      }
      for (const trip of demoTrips) {
        list.push({
          id: `demo-${trip.id}`,
          group: "demo",
          label: trip.label,
          icon: <RouteIcon aria-hidden size={18} />,
          run: () => {
            setOpen(false);
            onDemoTrip?.(trip);
          },
        });
      }
      recent.forEach((p, i) =>
        list.push({ id: `recent-${i}`, group: "recent", label: p.label, icon: <Clock aria-hidden size={18} />, run: () => choose(p) }),
      );
    }
    return list;
    // choose and locate are stable enough for a render; keep the list in sync with inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.[0], coords?.[1], visibleResults, query, demoTrips, recent, onChooseOnMap]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (options.length ? (a + 1) % options.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && options[active]) {
        e.preventDefault();
        options[active].run();
      } else if (open && options.length && options[0].group === "results") {
        e.preventDefault();
        options[0].run();
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (text) {
        setText("");
      }
    }
  };

  const groups: { key: Option["group"]; title?: string }[] = [
    { key: "results" },
    { key: "actions" },
    { key: "demo", title: t("demoTrips") },
    { key: "recent", title: t("recent") },
  ];
  const activeId = open && active >= 0 && options[active] ? `${id}-${options[active].id}` : undefined;

  return (
    <div className={cn("pa-combobox", className)}>
      <label htmlFor={`${id}-input`} className={hideLabel ? "sr-only" : "pa-field-label"}>
        {label}
      </label>
      <div className="pa-combobox-field">
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={message ? `${id}-msg` : undefined}
          autoComplete="off"
          spellCheck={false}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- only used where the page's single purpose is this field
          autoFocus={autoFocus}
          placeholder={placeholder ?? t("placeholder")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
            setMessage(null);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="pa-combobox-input"
        />
        {searching && <span className="pa-combobox-spinner" aria-hidden />}
        {text && (
          <button
            type="button"
            className="pa-combobox-clear"
            aria-label={t("clear")}
            onClick={() => {
              setText("");
              inputRef.current?.focus();
            }}
          >
            <X aria-hidden size={18} />
          </button>
        )}
      </div>
      {message && (
        <p id={`${id}-msg`} className="pa-field-message">
          {message}
        </p>
      )}
      <div id={listId} role="listbox" aria-label={label} className="pa-listbox" hidden={!open || options.length === 0}>
        {groups.map(({ key, title }) => {
          const items = options.map((o, i) => ({ o, i })).filter(({ o }) => o.group === key);
          if (!items.length) return null;
          return (
            <div key={key} role="group" aria-label={title ?? label}>
              {title && (
                <div aria-hidden className="pa-listbox-group">
                  {title}
                </div>
              )}
              {items.map(({ o, i }) => (
                  // Options are never focused: focus stays in the input (aria-activedescendant), which handles keys.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={o.id}
                    id={`${id}-${o.id}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === active}
                    className="pa-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => o.run()}
                    onMouseEnter={() => setActive(i)}
                  >
                    {o.icon}
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.detail && <span className="block truncate text-sm text-ink-muted">{o.detail}</span>}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
