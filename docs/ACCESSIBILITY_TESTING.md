# Manual accessibility testing

Automated checks catch roughly a third of real-world issues. Run these scripts before each release and record results (date, device, AT version, pass/fail, notes) in the PR.

## Setup

- `npm run build && npm run start`, open `http://localhost:3000/en`.
- Test both `/en` and `/fr`, light and dark, and at 150% text size (Settings → Display & reading).
- Use the sample trip link: `/en/navigate?from=43.6453,-79.3806&to=43.6487,-79.3715&fromName=Union%20Station&toName=St.%20Lawrence%20Market`.

## 1. Keyboard only (no mouse)

1. Press Tab once: "Skip to main content" appears. Press Enter: focus lands on the main content.
2. On the landing page, Tab to the search, type "Union", ArrowDown through suggestions, Enter. You arrive at the planner with the destination filled.
3. In the planner, Tab to the route options. Use ArrowUp/ArrowDown: the checked route changes and the map highlights it.
4. Tab to "Route details", Enter. Focus is on the details heading. Use ArrowLeft/Right across tabs.
5. Start directions; Next/Previous step work with Enter/Space; End directions returns.
6. Press Ctrl/⌘ + K anywhere; type "settings"; Enter.
7. Every focused element must show a clearly visible outline. Nothing should be reachable that you can't see, and no focus should get trapped (except inside open dialogs, where Escape closes).

## 2. VoiceOver (macOS Safari, iOS Safari)

1. Rotor → Landmarks: banner, main navigation, main, route planner, contentinfo.
2. Rotor → Headings on the landing page: a single H1, then section H2s in order.
3. Plan a route: you should hear "3 routes found. Suggested route: … about … minutes."
4. On a route option: VoiceOver reads "Option 1, Suggested: 960 m, about 16 minutes. No known conflicts with your preferences. Radio button, 1 of 3", then the facts after a pause.
5. Change route with VO + arrow keys: hear "Route 2 selected…".
6. iOS: in the planner's bottom sheet, the handle is announced as "Show more/Show less, button, expanded/collapsed"; double-tap changes the sheet size.
7. Report flow: after "Send report", focus and speech go to "Saved on this device — not sent" (or the success message when a backend is connected).

## 3. NVDA + Firefox / Chrome (Windows)

1. Browse mode: `D` for landmarks, `H` for headings — same structure as above.
2. Address search: in focus mode, typing announces the suggestion count; ArrowDown reads each option with its secondary line.
3. Settings: switches announce "toggle button, pressed/not pressed" with their hint text; sliders announce values like "6%".
4. Help centre: type in the search; the number of matches is announced.

## 4. TalkBack (Android Chrome)

1. Swipe through the planner: the map region is announced as "Map of routes and reported conditions"; hazard markers on the selected route are buttons with full descriptions ("Stairs, Verified. Verified 2 months ago").
2. Explore by touch on route cards: each is a single radio with a concise name.

## 5. Low vision & cognitive

- 200% browser zoom and 150% in-app text: no content clipped or overlapping; no horizontal scrolling.
- High contrast (Settings → Contrast → High): borders are solid black/white; links are underlined.
- Windows High Contrast / forced colours: focus outlines and state icons remain visible.
- Reduced motion (OS setting or Settings → Motion): no route draw-on, no fades, no scanning animation in photo analysis.
- Read every error message aloud: does it say what happened and what to do next?

## 6. Motor

- Every target ≥ 44 × 44 px. Try with a mouse at reduced precision and on a phone with one hand (thumb reach on the bottom sheet).
- Nothing requires dragging: the bottom sheet, sliders (arrow keys) and map (buttons + arrow keys) all have alternatives.
- Switch Control (iOS) / Switch Access (Android): complete "plan a route → select route 2 → start directions".

## Reporting a failure

Record the WCAG criterion, the steps, the AT/browser versions and a screen recording if possible. Add an automated regression test in `e2e/` when the failure can be expressed as one.
