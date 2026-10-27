# Design system & brand

## Idea

**The route is the brand.** The mark is a single continuous path that draws a "P": it starts at an open origin ring, rises without a single step, turns through a generous bowl, and arrives at a solid destination point. No wheelchair pictogram — PathAble is about routes, not diagnoses. The same ring-and-dot pair marks origin and destination on the map, in the hero illustration and in the states explorer, so the logo is literally how the product draws a trip.

Assets: `public/brand/` — `pathable-mark.svg`, `pathable-mark-inverse.svg`, `pathable-wordmark.svg`, `pathable-app-icon.svg`. React: `<Logo />` and `<PathAbleMark />` in `src/features/brand/logo.tsx`.

## Colour

All tokens live in `src/app/globals.css` and are mapped into Tailwind with `@theme inline`. Light, dark, high contrast and high-contrast dark are separate token sets; `npm run tokens:check` verifies every text/background pair against WCAG 2.2 AA (4.5:1 text, 3:1 UI) on every CI run.

| Token | Light | Role |
| --- | --- | --- |
| `--bg` | `#faf7f0` warm ivory | page |
| `--surface` / `--surface-raised` | `#fffdf8` / `#ffffff` | cards, panels |
| `--fg` | `#181c19` rich charcoal | text |
| `--fg-muted` | `#4a514b` | secondary text (≥ 7:1 on ivory) |
| `--forest` / `--primary` | `#12372a` | primary actions, brand |
| `--emerald` / `--accent` | `#0a6a4b` | accent, focus, verified |
| `--teal` / `--info` | `#2c6b70` | information |
| `--barrier` | `#b42318` | known barriers |
| `--unverified` | `#8a5300` | reported, unverified |
| `--unknown` | `#5f665f` | no data |
| `--winter` | `#1f5a8a` | snow & ice |

Deliberately avoided: purple AI gradients, glassmorphism stacks, colour-only status.

## Knowledge states (the core visual language)

| State | Colour | Line | Icon |
| --- | --- | --- | --- |
| Known accessible | verified | solid | check circle |
| Known barrier | barrier | solid with a light centre stripe | octagon ✕ |
| Reported, unverified | unverified | dashed | triangle ! |
| No data | unknown | dotted | circle ? |

Hazard markers also encode status by **shape**: verified = filled circle; reported = hollow dashed diamond; winter hazards use the winter tone.

## Typography

- **Atkinson Hyperlegible Next** (400/500/600) for all UI and body text — designed for low-vision readers; unambiguous `Il1` and `0O` matter outdoors on a phone.
- **Atkinson Hyperlegible Mono** for aligned numerals (step counters).
- **Instrument Serif** only for editorial headlines on marketing pages.
- Fluid scale (`--text-display`, `--text-headline`, `--text-title`) in `rem`, so the in-app text-size setting (100–150%) scales everything.
- Non-Latin scripts fall back to system Noto/PingFang faces with taller line-height for Devanagari, Bengali, Gurmukhi, Tamil, Arabic and Urdu.

## Space, shape, depth, motion

- Radius tokens 6 / 10 / 14 / 20 / 28 px. Interactive controls are fully rounded; containers use 14–28 px.
- Four warm, low-spread shadow levels (`shadow-1…4`).
- Motion tokens: `--ease-out` cubic-bezier(.22,1,.36,1); 120/200/320/560 ms. Motion is used for one orchestrated moment per surface (route draw-on, step transition, success check) and always respects reduced motion.
- Touch target: 44 × 44 px minimum (tested).

## Components

`src/components/ui`: Button (8 variants, loading state), Dialog, Sheet, Tabs, Accordion, Tooltip, Popover, DropdownMenu, Segmented control, Switch, Checkbox, Slider, Input/Textarea/Field, Callout, Badge, EmptyState, ProgressBar, Spinner, Skeleton.

Feature components: PlaceSearch (combobox), RouteCard, CoverageBar, RouteExplanation, RouteDetails, GuidanceView, MapControls, HazardMarker, HazardDetails, WinterAdvisory, ProfilePicker, PreferencesForm, DisplaySettings, DetectionOverlay, BackendNotice, LanguageSwitcher, CommandPalette.

## Map tokens

`--map-route-selected`, `--map-route-casing`, `--map-route-alt`, `--map-user`, plus the four state colours. MapLibre reads them at runtime, so theme and contrast changes recolour routes without reloading.
