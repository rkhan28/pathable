# Component research, selection & licensing

Each source was evaluated for accessibility, performance, visual quality, responsiveness, maintainability, licence, keyboard support, reduced-motion behaviour and fit with PathAble's calm, legible design language. **A component that looked impressive but hurt accessibility or clarity was adapted or rejected.** Licences were checked against each project's repository on 2026-10-27.

## Selected and integrated

| Source | Licence | What we use | Why / how it was adapted |
| --- | --- | --- | --- |
| **Radix UI** (via the `radix-ui` package) | MIT | Dialog, Popover, Tooltip, Tabs, Accordion, DropdownMenu, ToggleGroup, Switch, Checkbox, Slider, Label, Slot | Battle-tested focus management, roving tabindex, Escape handling and ARIA. The foundation for every interactive primitive. |
| **shadcn/ui** (new-york-v4 registry source) | MIT | Patterns for Button, Dialog, Sheet, Tabs, Accordion, Tooltip, Popover, DropdownMenu, form controls, Sonner wrapper | Copied from the registry source and rewritten against PathAble tokens: 44 px touch targets, a single non-colour focus outline, `rem`-based sizing for text scaling, logical properties for RTL, loading states that keep labels for screen readers. Lives in `src/components/ui`. |
| **cmdk** | MIT | Command palette (⌘K / Ctrl+K) | Fast, accessible filtering. Loaded lazily on first use so it costs nothing on page load. |
| **Sonner** | MIT | Non-critical toasts | Restyled to tokens. Policy: toasts are never the only place safety-relevant information appears (they disappear) — those go inline and through the live regions. |
| **Motion for React** | MIT | Route draw-on in the hero, onboarding step transitions, detection box reveal, success check | Every use checks reduced motion (OS setting *and* in-app override via `MotionConfig`). |
| **Magic UI — Blur Fade** | MIT | Hero pill and illustration entrance | Adapted: renders static when reduced motion is requested; removed in-view/AnimatePresence logic; **removed from the headline and lede** after Lighthouse showed the entrance delayed LCP. |
| **Magic UI — Dot Pattern** | MIT | Snow texture in the winter band | Rewritten from one animated `<motion.circle>` per dot (+ resize listener) to a single SVG `<pattern>`: one DOM node, no JS, no motion. |
| **Lucide** | ISC | All UI icons | Consistent 24 px / 2 px stroke grammar. Missing mobility aids (scooter, walker, cane), stairs, curb ramp and snow-path icons were drawn originally in the same grammar (`profile-icons.tsx`, `hazard-visuals.tsx`). |
| **MapLibre GL JS** | BSD-3-Clause | Interactive map | Open-source, vendor-neutral, works with any vector tile provider. Custom controls replace the built-in ones for larger targets and translated labels. |
| **OpenFreeMap** tiles/styles | MIT (project), OSM data ODbL, OpenMapTiles BSD-3 / CC-BY | Default basemap (no API key) | Attribution shown by MapLibre's attribution control. Swappable via env (e.g. MapTiler). |
| **Photon** (komoot) geocoder | Apache-2.0 (software), OSM data ODbL | Address autocomplete | Explicitly supports search-as-you-type, unlike Nominatim's public instance. For production traffic: self-host or use a commercial Photon provider. |
| **Atkinson Hyperlegible Next / Mono**, **Instrument Serif** | SIL OFL 1.1 | Typography | Self-hosted via `next/font/local` (no third-party font requests). Licences in `src/fonts/`. |

## Evaluated and not used (and why)

| Source | Decision |
| --- | --- |
| **Aceternity UI** (Spotlight, Background Beams, 3D cards, Lamp, etc.) | Rejected. Visually striking but motion-heavy, mostly decorative, and several rely on hover-only reveals or canvas effects with no text equivalent. They'd compete with the map for attention and add main-thread work on low-end phones. |
| **React Bits** | Rejected. Licence is **MIT + Commons Clause** (use inside a product is permitted, but it restricts redistribution of the components themselves), and the text-animation components split headings into per-character spans, which some screen readers read letter by letter. |
| **Magic UI — Number Ticker, Animated Beam, Marquee, Border Beam** | Rejected. Animated numbers make route stats harder to read and announce; marquee motion fails WCAG 2.2.2 unless pausable; beams are decoration. PathAble shows no vanity metrics to animate. |
| **21st.dev** community components | Reviewed for patterns; nothing copied. Licences vary per component and the useful patterns (combobox, bottom sheet) needed accessibility work we'd rather own. |
| **Ark UI** | MIT and accessible, but would duplicate Radix. One primitive system keeps the design system coherent and the bundle smaller. |
| **Vaul** (drawer) | Rejected for the map's bottom sheet: the repository is marked unmaintained, and it's a *modal* drawer, while a persistent map sheet must be non-modal (it shouldn't trap focus). Replaced with a small custom sheet whose snap states are reachable by buttons and arrow keys. |
| **Hugeicons** | Not used. Free tier licence terms are more restrictive than Lucide's ISC, and mixing icon families breaks visual consistency. |
| **Figma Community** assets | Not used; the brand, logo, illustrations and icons are original. |

## Product references (principles, not copies)

- **Apple Maps** — route alternatives as quiet secondary lines with one emphasised route; generous type in turn-by-turn.
- **Google Maps** — tapping an alternative line selects it; "use my location" and "choose on map" in the search field itself.
- **Linear** — keyboard-first command palette; one consistent focus language.
- **Airbnb** — warm neutral surfaces; human copy; large tappable cards.
- **Uber** — bottom sheet as the primary mobile surface over an edge-to-edge map.
- **Stripe** — contracts as documentation; errors with codes and actionable messages.
- **Notion / Arc** — calm chrome that recedes behind content.

## Attribution requirements honoured

- OSM/OpenMapTiles/OpenFreeMap attribution is rendered on the map, in the footer, and in search results.
- Font licences ship in `src/fonts/`.
- MIT notices for adapted shadcn/ui and Magic UI code are recorded in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) and in file headers.
