# Architecture & key decisions

## Rendering model

- **Next.js 16 App Router with Cache Components + Partial Prefetching.** Every route is prerendered at build time for both locales (`generateStaticParams` in the root layout). Interactive surfaces (planner, report flow, settings) are client islands inside static shells.
- **Locale as a root param.** The root layout lives at `app/[locale]/layout.tsx`. `i18n/request.ts` reads the locale with `next/root-params` (the approach next-intl recommends for Cache Components), so no `setRequestLocale` calls are needed and unknown locales 404.
- **`proxy.ts`** (Next 16's renamed middleware) runs next-intl's locale negotiation. URLs use short prefixes (`/en`, `/fr`) mapped to full BCP 47 tags (`en-CA`, `fr-CA`) so `Intl` formats Canadian dates and numbers.
- **Route groups:** `(site)` pages get a sticky header and footer; `(app)` pages get a compact header so the map and forms get the room.
- **React `<Activity>`:** with Cache Components, previously visited routes stay mounted but hidden. Tests count only visible matches and stores live outside the route tree so state survives navigation.

## State

| Kind | Where | Why |
| --- | --- | --- |
| Server data (routes, hazards, geocoding, analysis) | TanStack Query | caching, cancellation, retries only for retryable errors, `keepPreviousData` while preferences change |
| Mobility + display preferences | Zustand `persist` → `localStorage` | survives sessions; validated with Zod on load |
| Current trip (origin, destination, selected route) | Zustand `persist` → `sessionStorage` | a destination is sensitive; it shouldn't outlive the session |
| Reports made on this device | Zustand `persist` → `localStorage` | honest "not sent" drafts when there's no backend |
| Screen-reader announcements | tiny Zustand store + two persistent live regions | avoids duplicate/dropped announcements from ad-hoc `aria-live` |

Stores use `skipHydration` and rehydrate after mount, so the first client render matches server HTML (no hydration mismatch). Display settings are applied before first paint by an inline boot script (no theme flash, no text-size jump), then kept in sync by `DisplaySync`.

**Language switching preserves state** because stores are outside the route tree and the switcher carries the query string. Re-applying a shared link's coordinates after the switch is a no-op (`samePlace`), so the selected route survives — covered by an e2e test.

## API layer

- `api/contracts.ts` is the contract: Zod schemas for every request and response. Types are inferred from them.
- `api/http.ts` validates every response. A response that doesn't match is an error (`contract_mismatch`), never rendered — wrong accessibility data is worse than none.
- `api/service.ts` defines `PathAbleService` with three implementations chosen by environment: `HttpPathAbleService` (live), `FixturePathAbleService` (development only, lazy-loaded) and `UnavailablePathAbleService`.
- Human-readable text is **not** in the contract. The API returns codes (maneuvers, reasons, notes); the client renders them in the person's language. This is what makes directions translatable and voice guidance grammatical.

## Map

- **MapLibre GL JS 6**, code-split with `next/dynamic` so landing and content pages never load it.
- MapLibre v6 resolves its worker relative to its own module URL, which bundlers relocate. `scripts/copy-maplibre-worker.mjs` (run on `postinstall`) copies the worker into `public/vendor/` and the map calls `setWorkerUrl()`.
- Route layers are styled from CSS custom properties read at runtime, so dark mode and high contrast recolour the map. Theme changes swap the basemap style and reinstall layers.
- **Graceful failure:** if the style can't load (offline, blocked, provider down), the map switches to a plain background style so routes, markers and interaction still work, and tells the person the panel has everything as text. If WebGL is unavailable it shows an explanation instead of a blank box.
- **Markers as React:** hazard markers are rendered through portals into MapLibre marker elements, so they're real `<button>`s with Radix popovers. Only hazards on the selected route are in the tab order; nearby ones are listed in the panel instead, so keyboard users aren't forced through dozens of stops.

## Accessibility architecture

- One focus style everywhere (3px outline + offset, 4px in high contrast).
- Status is encoded three ways: colour, line pattern (solid / striped / dashed / dotted), and icon + label. `features/routing/status-visuals.tsx` is the single source for all of them.
- Route options are a native radio group (arrow keys, form semantics, correct announcements for free). The address search implements the WAI-ARIA 1.2 combobox pattern with `aria-activedescendant`.
- Focus moves to the new heading on step changes (onboarding, report flow, route details, guidance). With `AnimatePresence`, onboarding focuses via a callback ref once the new step has actually mounted.
- The mobile bottom sheet is non-modal (it shouldn't trap focus) and every snap state is reachable by button or arrow keys — dragging is optional.
- Text scaling multiplies the root font size; everything is in `rem`, so 150% reflows without horizontal scrolling (tested).
- Logical CSS properties throughout (`ms-`, `pe-`, `start-`, `end-`) so Arabic and Urdu will mirror; directional icons flip with `rtl:rotate-180`.

## Security

- Security headers in `next.config.ts` (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy` that allows only camera and geolocation for this origin).
- A strict Content-Security-Policy is deferred until production tile, geocoder and API hosts are final; MapLibre also needs `worker-src blob:`/self. This is a known TODO, not an oversight.
- Photos are re-encoded through a canvas before upload, which strips EXIF (including GPS) and caps size.
- Personal notes are stored locally and are never part of any API payload.

## What's intentionally not here

- Authentication: there's no backend to authenticate against yet. Settings explains this honestly.
- Real-time GPS step advancement: until routes follow real sidewalks, auto-advancing would imply precision that doesn't exist. Guidance advances manually.
- Weather-derived hazards: weather isn't sidewalk condition.
