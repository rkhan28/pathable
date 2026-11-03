# Accessibility testing

## Automated checks (every change, CI)

- **axe-core**, with the WCAG 2.0/2.1/2.2 A and AA tags, on every page:
  - in en-CA and fr-CA;
  - in light, dark, light high-contrast and dark high-contrast;
  - plus open states: the language menu, mobile menu, combobox options, route
    list, "Why this route?", each details tab, guidance, and the delete-all
    alert dialog.
  - Result on 2026-11-03: **0 violations** (`e2e/accessibility.spec.ts`).
- **Keyboard** (`e2e/keyboard.spec.ts`):
  - skip link first, and it moves focus;
  - route cards change with the arrow keys;
  - the combobox works with arrows, Enter and pasted coordinates;
  - geocoder results can be chosen by keyboard;
  - onboarding moves focus to each step's heading;
  - the mobile sheet handle resizes with ArrowUp and End.
- **Layout** (`e2e/layout.spec.ts`):
  - no horizontal scrolling at 390 px with 150% text, on 9 pages;
  - 44 px minimum targets, except inline links (the WCAG 2.5.8 exception).
- **Contrast** (`scripts/check-contrast.mjs`): 156 token pairs, 4.5:1 for text,
  3:1 for non-text, and 7:1 for text in high contrast.
- **Lint:** every rule in jsx-a11y strict is an error.

### Found and fixed by these checks

- The language button showed "EN" but was named "Language: English (Canada)".
  That fails WCAG 2.5.3; voice-control users could not say what they saw.
- A modal Radix menu hid the skip link with `aria-hidden` while it stayed
  focusable.
- At 150% text, a table and a long button label overflowed 390 px.
- Settings switches were 32 px tall.

**Automated checks do not prove accessibility.** No conformance is claimed
until a manual audit and user testing are done.

## Manual scripts

Run each script with the en-CA and fr-CA interfaces. Record the date, browser,
assistive technology version and outcome, and file every failure as an issue.

### VoiceOver (macOS Safari and iOS Safari)

1. Load the landing page. Rotor, then Headings: the h1 and the section h2s are
   listed in order.
2. Use the "Where to?" combobox. Type "Finch". The result count is announced.
   Arrow to an option, which is announced as "option, 1 of n". Press Enter.
3. In the planner, the "Routes updated" announcement is heard once. Move
   between route cards with the arrow keys; each card's distance, time and
   compatibility are read.
4. Open "Why this route?". The reasons are read as a list.
5. Open Route details, then the Sections tab. Each attribute's value, source and
   date are read; none is read as colour only.
6. Start guidance. The step instruction is focused and read. Move to the next
   step. Turn on Read aloud.
7. On iOS, the sheet handle can be activated and announces its position.

### NVDA with Firefox (Windows)

Run the same steps in browse and focus modes. Also confirm:
- the combobox switches NVDA to focus mode;
- tabs are announced as a tab list;
- the delete-all alert dialog is read when it opens, and focus lands on Cancel.

### TalkBack (Android Chrome)

Run the same steps with explore-by-touch. Also confirm:
- map controls are reachable and named;
- hazard markers on the map are announced as buttons with their kind and
  status.

### 200% zoom (browser) and 150% in-app text size

At 1280 px with 200% browser zoom:
- there is no horizontal scroll;
- the planner sidebar stays usable;
- dialogs fit the viewport.

Repeat with the in-app text size at 150%.

### Forced colours (Windows High Contrast)

- Route lines remain distinguishable by pattern.
- Focus rings use Highlight.
- The coverage bar legends carry the information as text.

### Switch Control (iOS)

- Every control in the planner can be reached by item scanning.
- The sheet can be resized with the handle button. No drag is required.

## User-testing plan (not yet carried out)

**Participants.** Five adults:

| # | Uses |
| --- | --- |
| 1 | Manual wheelchair |
| 2 | Powered wheelchair or scooter |
| 3 | Walker or rollator |
| 4 | Cane, or reduced mobility |
| 5 | Screen reader user who is also a pedestrian |

**Recruitment and consent.**
- Recruit through Toronto disability organisations, not by convenience
  sampling.
- Pay participants for their time.
- Written or recorded verbal consent, in plain language, given before the
  session.
- Participants can stop at any time.
- No video of faces. Screen recording only with consent.

**Tasks.** Remote or in person, about 60 minutes:
1. Set up preferences, or skip setup.
2. Plan York University to Finch West, and say which route you would take and
   why.
3. Find out why a stretch says "no data".
4. Follow guidance for the first five steps.
5. Report a barrier, as a draft or sent.
6. Change the text size and theme.

**Measures.**
- Task success, scored as unaided, aided or failed.
- Time on task.
- Errors.
- Single Ease Question after each task.
- Whether the person's chosen route matches the top-ranked route, and why.
- Comprehension of the four states: ask the person to explain each one back.

**Output.** An anonymised findings report in `docs/research/`, with issues filed
against the product.

## Slope field check (not yet carried out)

The 10 sites are listed in [`DATA_REPORT.md`](DATA_REPORT.md), section 5.

**Equipment.** A digital level at least 60 cm long, or a calibrated smartphone
inclinometer.

**At each site:**
- Measure the running slope at three points along a 10 m stretch.
- Record the maximum and the mean, with the date, time and a photo of the
  stretch.

**Afterwards:** report the error of the lidar slope against the field reading
for each slope band.
