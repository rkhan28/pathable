# Accessibility audit results

**Target:** WCAG 2.2 Level AA. **Status:** automated and scripted keyboard checks pass; no independent audit and no testing with disabled participants yet, so conformance is **not** claimed.

Last run: 2026-10-27, production build (`next build && next start`), Chrome for Testing 153, `@axe-core/playwright` 4.14, Lighthouse 13.5.

## Automated: axe-core (WCAG 2.0/2.1/2.2 A + AA + best practices)

**31 scans, 0 violations.**

| Scope | Scans |
| --- | --- |
| Every route, English: `/`, `/navigate` (empty and with routes), `/onboarding`, `/report`, `/settings`, `/coverage`, `/accessibility`, `/help`, `/contact`, `/privacy`, `/terms`, `/ai`, 404 | 14 |
| French: `/`, `/navigate` with routes, `/report`, `/settings` | 4 |
| Dark theme: landing, planner with routes, settings, report | 4 |
| High contrast: landing, planner with routes, settings, report | 4 |
| Route details, Sections tab, step-by-step guidance | 3 |
| Command palette dialog, language menu | 2 |

Scans run with reduced motion so final visual states are measured (an earlier run caught a contrast failure measured mid-fade). MapLibre's third-party attribution control is excluded from scans and checked manually.

### Issues found and fixed during this audit

| Rule | Where | Fix |
| --- | --- | --- |
| `label-content-name-mismatch` (2.5.3) | Language button showed "EN" but was named "Change language…" | Visible text now starts the accessible name ("EN, change language…") |
| `landmark-unique` | Two "My reports" regions on Settings | Inner list no longer a landmark |
| `listitem` | Route cards were `<li>` inside a `role="radiogroup"` `<ul>` | Group is a `div`; cards are `div`s |
| `aria-required-children` | Language menu contained a `<p>`/`<ul>` | Unavailable languages are now disabled menu items with "Coming later" |
| Touch target < 44 px | Swap button 36 px, clear buttons 40 px | Raised to 44 px |
| Reflow at 150% text | Long headline words and `nowrap` buttons overflowed at 412 px | Headings break long words; buttons wrap |

## Lighthouse (accessibility category)

| Page | Mobile | Desktop |
| --- | --- | --- |
| Landing | 100 | 100 |
| Planner with routes | 100 | 100 |
| Report | 100 | — |
| Settings (French) | 100 | — |

## Scripted keyboard & interaction tests (Playwright)

- Skip link is the first tab stop and moves focus to `<main>`.
- Route options: native radio group; ArrowDown selects the next route, focus follows, the map updates, and the change is announced ("Route 2 selected…").
- Results are announced: "3 routes found. Suggested route: 960 m, about 16 minutes."
- Address search: combobox with `aria-activedescendant`; ArrowDown/Enter select; Enter before results arrive still selects the top result.
- Focus moves to the new heading in route details, guidance, onboarding steps and report outcomes.
- Command palette opens with Ctrl/⌘ + K and navigates by keyboard.
- Mobile bottom sheet: every snap state reachable with ArrowUp/ArrowDown on its handle (no dragging required).
- Destructive action ("Delete all data") requires an `alertdialog` confirmation.

## Layout & sensory

- No horizontal scrolling at 412 px on 10 pages, at **150% text size** on 4 key pages, and with `dir="rtl"` on 3 pages.
- All interactive targets on the planner ≥ 44 × 44 CSS px (inline text links excepted per 2.5.8).
- Colour tokens: every text/background pair ≥ 4.5:1 and UI pairs ≥ 3:1 in light, dark, high contrast and high-contrast dark (`npm run tokens:check`).
- No information conveyed by colour alone (see the knowledge-state table in `DESIGN_SYSTEM.md`).
- Pinch-zoom is never disabled.

## Known gaps

1. **No testing with disabled participants yet.** This is the most important next step — especially wheelchair, scooter and low-vision users outdoors.
2. **Screen-reader matrix not yet run manually** on real devices; see `ACCESSIBILITY_TESTING.md` for the scripts.
3. The map canvas is visual-only by design; equivalent information lives in the panel. Whether that's sufficient should be validated with blind and low-vision users.
4. Voice guidance relies on the device's speech voices; French-Canadian voices aren't available everywhere.
5. Only English and French are enabled; RTL is verified for layout only until Arabic/Urdu translations exist.
