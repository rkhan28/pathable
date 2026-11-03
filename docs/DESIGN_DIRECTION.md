# Design direction: Wayfinding

PathAble's visual language is built from the physical street.

| Street element | Where it appears in the interface |
| --- | --- |
| Concrete | Surfaces |
| Painted crossings | The route line |
| The yellow tactile pad at a curb ramp | The one colour that asks for attention |
| Truncated domes on a curb ramp | The only texture, used sparingly |

Everything else gets out of the way of the map.

Test for every decision: **would this look the same on a generic SaaS page?**
If yes, change it.

## Principles

1. **The map is the product.** On the landing page and in the planner the map is
   the largest object on screen. Panels layer over it; they never frame it in a
   box.
2. **Evidence before adjectives.** We show the number, the source and the date,
   not a word like "accessible" on its own.
3. **One bold thing per screen.** Each screen gets one of: the selected route
   line, the primary action, or the hero headline. Never two.
4. **Calm motion caused by the person.** Things move because someone did
   something, never to decorate a scroll.
5. **Uncertainty is visible, never alarming.** "No data" is a calm grey dotted
   line with an explanation, not a warning.

## Colour tokens

All colours are CSS custom properties in `apps/web/src/styles/tokens.css`.
`scripts/check-contrast.mjs` reads that file and fails CI when any declared
pair falls below WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and non-text.

### Light (default)

| Token | Value | Role |
| --- | --- | --- |
| `--surface` | `#F3F4F1` | Concrete. The page background. |
| `--surface-raised` | `#FFFFFF` | Sheets, cards and inputs over the map |
| `--surface-sunken` | `#E6E8E3` | Wells, track backgrounds |
| `--ink` | `#0D1411` | Body text |
| `--ink-muted` | `#47514C` | Secondary text |
| `--line` | `#7A837E` | Control borders (≥ 3:1) |
| `--line-subtle` | `#D5D9D3` | Dividers. Decorative only, never the only boundary of a control. |
| `--brand` | `#0F3D2E` | Forest. Header mark, brand text, focus ring. |
| `--signal` | `#13A06B` | Signal Emerald. **Only** the selected route and the one key action. Its label text is `--ink`, not white: white on emerald is 3.3:1. |
| `--attention` | `#F2C230` | Curb Yellow. Fills with ink text only, such as the fixture banner and winter chip. Never text on light. |
| `--state-verified` | `#0E7A52` | Known accessible: text and line |
| `--state-barrier` | `#B3261E` | Known barrier |
| `--state-unverified` | `#8F5600` | Reported but unverified |
| `--state-unknown` | `#5F6964` | No data |
| `--winter` | `#235E9E` | Winter advisories |

### Dark: night street

Not an inversion. The surfaces are wet asphalt under sodium light: warm-neutral
near-blacks. Green brightens because forest disappears at night.

| Token | Value |
| --- | --- |
| `--surface` | `#0E1311` |
| `--surface-raised` | `#18201C` |
| `--surface-sunken` | `#080B0A` |
| `--ink` | `#E9EDE7` |
| `--ink-muted` | `#A8B2AC` |
| `--line` | `#6E7873` |
| `--line-subtle` | `#2A332E` |
| `--brand` | `#7FD1A9` |
| `--signal` | `#2BC48A` |
| `--attention` | `#F2C230` (with ink `#0D1411`) |
| `--state-verified` | `#4FD39B` |
| `--state-barrier` | `#FF8A80` |
| `--state-unverified` | `#F0B45A` |
| `--state-unknown` | `#A0AAA5` |
| `--winter` | `#8DB8F0` |

### High contrast (light and dark)

Turned on by `data-contrast="more"`, or by `prefers-contrast: more` when the
person hasn't chosen a setting.
- Ink becomes pure black or white.
- Muted text matches ink.
- `--line` matches ink.
- Every state colour reaches at least 7:1.
- The route line gains a 2 px casing in the surface colour.

## Knowledge-state encoding

Every state is encoded **three ways**: colour, line pattern, and an icon with a
label. Colour alone is never the signal.

| State | Line on map | Icon (Lucide) | Label |
| --- | --- | --- | --- |
| Known accessible | solid | `circle-check` | "Verified" |
| Known barrier | solid with a light centre stripe | `octagon-x` | "Barrier" |
| Reported but unverified | dashed 6/4 | `message-circle-warning` | "Reported" |
| No data | dotted 1/4, round caps | `circle-dashed` | "No data" |

Hazard markers: a verified hazard is a filled circle; a reported hazard is a
dashed diamond. Origin is an open ring and destination is a solid dot, the same
shapes as the logo.

## Type

- **Atkinson Hyperlegible Next**, weights 400 and 700 only, for everything,
  including display sizes. Display sizes use 700 with -0.02em tracking.
- **Atkinson Hyperlegible Mono** 400 with `tabular-nums` for distances, times,
  slopes and dates.
- Fonts are self-hosted and subset to Latin and Latin Extended.
- Sentence case everywhere. Line length is capped at 68ch for prose.

| Token | rem | px @100% | Use |
| --- | --- | --- | --- |
| `--text-xs` | 0.8125 | 13 | Legal and attribution only |
| `--text-sm` | 0.875 | 14 | Meta, chips |
| `--text-base` | 1 | 16 | Body |
| `--text-md` | 1.125 | 18 | Card titles, guidance body |
| `--text-lg` | 1.375 | 22 | Section headings |
| `--text-xl` | 1.75 | 28 | Page titles |
| `--text-2xl` | 2.5 | 40 | Marketing h2 |
| `--text-display` | clamp(2.5rem, 6vw, 4.25rem) | 40–68 | Hero headline only |
| `--text-guidance` | 1.75 | 28 | Step-by-step guidance instruction |

Text size setting (100–150%) scales `html { font-size }`, so every rem scales.

## Space, radius, depth

- **Space:** an 8 px grid (`--space-1` = 4 px, then 8, 12, 16, 24, 32, 48, 64,
  96). Marketing sections use 96 px vertical rhythm at desktop and 64 px at
  mobile. Planner panels use 16 px.
- **Radius carries hierarchy:**

  | Element | Radius |
  | --- | --- |
  | Controls | 999 px |
  | Sheets | 24 px |
  | Cards | 16 px |
  | Chips | 8 px |
  | Map controls | 999 px |

- **Depth comes from layering over the map**, not from shadows on a flat page.
  Raised surfaces over the map get one shadow token,
  `0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .10)`. Cards on a page
  get a border, not a shadow.

## Motion tokens (`apps/web/src/lib/motion.ts`)

| Token | Value |
| --- | --- |
| `spring.ui` | stiffness 380, damping 32 |
| `spring.sheet` | stiffness 260, damping 30 |
| `duration` | 120 (press), 200 (state), 320 (panel), 560 (route draw) ms |
| `camera` | easeOutCubic, 700–1100 ms, scaled by distance |

- **What may animate:** route draw-on, the selected route's flow, the camera,
  the sheet, card selection, toggle state, and one load moment per page (the
  hero route draw).
- **What never animates:** body text, numbers, the LCP headline, and anything
  on scroll.
- **Reduced motion** (OS setting or in-app setting): springs become instant,
  draw-on becomes a 120 ms opacity change, and the camera jumps.

## Logo

- One continuous stroke draws a **P**. It starts at an **open ring** (origin) at
  the foot of the stem, rises, turns around the bowl, and ends at a **solid dot**
  (destination) where the bowl meets the stem.
- Stroke caps are round, like a route line.
- It has no wheelchair pictogram. The product is for anyone who needs barrier
  information, and the mark should not reduce people to one device.
- **Deliverables:**
  - `pathable-mark.svg`
  - `pathable-mark-inverse.svg`
  - `pathable-wordmark.svg` (outlined, generated from the font)
  - `pathable-app-icon.svg`
  - React `<Mark/>` and `<Wordmark/>` components

## Tactile dome texture

- A truncated-dome grid on a 24 px pitch: 12 px domes with a 6 px flat top
  ring, in `--line-subtle`.
- **Allowed in exactly four places:** hero background (right half, behind the
  map edge), empty states, onboarding finish, and the app icon.
- **Never:** as a card fill, behind body text, or animated.

## Banned-list review

| Banned item | How this direction avoids it |
| --- | --- |
| Cream background + editorial serif | The surface is a cool concrete grey, and there is no serif. |
| Gradients, glow, glass, neon | None. Depth is the map plus one shadow token. |
| Tiny all-caps eyebrow | None. Section headings start with the heading. |
| 01/02/03 on non-sequences | Numbers appear only on "how it works", which is a real 4-step sequence that matches the planner flow. |
| Identical card grids | The landing page has no card grid. Route cards differ by state, and knowledge states are an interactive legend on a map strip. |
| One radius everywhere | Five radii carry hierarchy. |
| Fade-up on scroll, parallax, marquee, ticker, cursor effects | None. One load moment per page. |
| Emoji, "→" on links, "A · B · C" meta | Lucide icons only, link text stands alone, meta uses separate labelled items. |
| Marketing filler, stock art, fake avatars | Copy is reviewed against the word list in `apps/web/scripts/check-copy.mjs`. There are no people images. |

**Revision after review:**
- The first draft put the four knowledge states in four cards, which is an
  identical card grid. They became one horizontal map strip with a segmented
  control instead.
- The first draft also had an eyebrow over the hero: "North York pilot". It
  moved into the coverage line under the search.

## Wireframes

Legend: `▓` map, `░` dome texture, `[ ]` control, `( )` radio, `◯` origin
ring, `●` destination dot.

### Landing: 390 px

```
┌──────────────────────────────────┐
│ ◯P PathAble            [Menu]    │
├──────────────────────────────────┤
│ A city without limits begins     │  h1, 40px/700
│ with a better route.             │
│ ┌──────────────────────────────┐ │
│ │ Where to?                [⌖] │ │  combobox (real)
│ └──────────────────────────────┘ │
│ North York pilot. Coverage     │
│ [Find your route] Explore how... │  emerald pill + text link
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓◯━━━━━┓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  live map 56vh
│ ▓▓▓▓▓▓▓▓┗━━━━━━━━━━━━━━━━━●▓▓▓ │
│ [Wheelchair][Walker][Cane]       │  segmented control
│ Ranked for wheelchair: route A   │  one-sentence explanation
│ avoids 3 known barriers.         │
├──────────────────────────────────┤
│ How it works  1 2 3 4 (vertical) │
│ Four knowledge states (map strip)│
│ Reporting and AI                 │
│ Winter                           │
│ Trust and coverage               │
│ footer                           │
└──────────────────────────────────┘
```

### Landing: 1440 px

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◯P PathAble   How it works  Coverage  Help        [EN|FR] [Open planner] │
├──────────────────────────────┬───────────────────────────────────────────┤
│ A city without limits        │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░│
│ begins with a better route.  │▓▓◯━━━━━━━━┓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░│
│                              │▓▓▓▓▓▓▓▓▓▓▓┗━━━━━━━━━━━━━━━━━━━━━━━━━●▓▓░░│
│ [Where to?              ⌖]   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░│
│ [Find your route]  Explore…  │ ┌ Ranked for ───────────────────────┐   │
│                              │ │[Wheelchair][Walker][Cane]          │   │
│ North York pilot. Coverage │ │Route A avoids 3 known barriers.    │   │
│                              │ └────────────────────────────────────┘   │
├──────────────────────────────┴───────────────────────────────────────────┤
│ 5 more sections, 96px rhythm, left-aligned 12-col, text ≤ 68ch            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Planner `/navigate`: 390 px (sheet at middle snap)

```
┌──────────────────────────────────┐
│▓[≡]▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓[⌖]▓│  44px map controls
│▓▓▓◯━━━━━━┓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓[+]▓│
│▓▓▓▓▓▓▓▓▓▓┗━━━━━━━━━━━━━●▓▓▓▓[−]▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
╞══════════════[ — ]═══════════════╡  handle = button
│ ◯ York University stn       [⇅]  │
│ ● Yonge & Sheppard               │
│ Routes for your preferences      │
│ (•) A  2.9 km 41 min  ███▒▒░░░   │  radio cards + coverage bar
│ ( ) B  3.1 km 44 min  ██▒▒▒░░░   │
│ ( ) C  2.7 km 38 min  █▒░░░░░░   │
└──────────────────────────────────┘
```

### Planner: 1440 px

```
┌───────────────────────┬──────────────────────────────────────────────────┐
│ ◯P  [«]               │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓[⌖]▓▓│
│ ◯ From          [⇅]   │▓▓◯━━━━━━━━━━━┓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓[+]▓▓│
│ ● To                  │▓▓▓▓▓▓▓▓▓▓▓▓▓┗━━━━━━━━━━━━━━━━━━━━━●▓▓▓▓▓▓▓[−]▓▓│
│ Preferences: Walker ▾ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ (•) Route A  card     │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ ( ) Route B  card     │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ ( ) Route C  card     │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ Where they differ ▭▭▭ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ Nearby reports (3)    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ 400px sidebar         │                                    © OSM · City │
└───────────────────────┴──────────────────────────────────────────────────┘
```

### Route details (selected card morphs): 390 and 1440

```
┌──────────────────────────────────┐   1440: same panel replaces the card
│ [←] Route A    2.9 km · 41 min   │   list in the 400px sidebar
│ [Directions][Sections][Hazards]  │   tabs
│ 1  Head east on Sheppard Ave W   │
│    320 m  [Show on map]          │
│ 2  Cross Bathurst St at signal   │
│    APS: yes  Kerbs: no data      │
│ [Start guidance]                 │   emerald, the one action
└──────────────────────────────────┘
```

### Guidance (full screen, large text)

```
┌──────────────────────────────────┐
│ [×]                    Step 2/14 │
│                                  │
│ Cross Bathurst St                │  28px/700
│ at the signal.                   │
│ Kerb ramps here: no data.        │  18px
│                                  │
│ [◀ Previous]  [Read aloud]  [Next ▶] │  Lucide icons, 56px targets
└──────────────────────────────────┘
```

### Onboarding (4 steps): 390 and 1440

```
┌──────────────────────────────────┐  1440: two columns, preview on the right
│ Step 1 of 4             [Skip]   │
│ What do you usually travel with? │
│ (•) Manual wheelchair            │
│ ( ) Powered wheelchair  … custom │
│ ░░░▓▓◯━━━━━●▓▓░░░ mini preview   │  dome tile + live mini route
│ [Back]                  [Next]   │
└──────────────────────────────────┘
```

### Report flow: 390 and 1440

```
┌──────────────────────────────────┐  1440: centred 640px column over a
│ Report a barrier   Step 1 of 5   │  dimmed map showing the chosen point
│ [ Add photo ]  (EXIF removed)    │
│ ▓▓▓ location picker ▓▓▓          │
│ AI review: unavailable (calm)    │
│ Details form                     │
│ [Send report]                    │
└──────────────────────────────────┘
```

### Settings and trust pages

Single column, 68ch max, left aligned. Settings groups use cards with borders,
not shadows. Trust pages are documents: h1, last-updated date, sections, no
decoration.
