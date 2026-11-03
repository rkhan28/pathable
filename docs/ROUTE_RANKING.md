# Route ranking

The same rules are implemented in two files:
- `services/api/pathable_api/scoring.py`
- `apps/web/src/lib/scoring.ts`

Both are tested against `contracts/fixtures/scoring-cases.json`.

## 1. Each attribute is checked against the person's preferences

| Attribute | Pass | Fail | Unknown |
| --- | --- | --- | --- |
| Presence (road edges) | sidewalk mapped | `sidewalk=no` | not tagged |
| Steps | not steps, or steps when stairs are allowed | steps when "avoid stairs" is on | — |
| Surface | paved set | loose or rough set, when "avoid damaged surfaces" is on | untagged, or ambiguous (wood, bricks) |
| Width | ≥ minimum + error | < minimum − error | missing, or within ±error (0.12 m) of the minimum |
| Running slope | both lidar surveys pass | both surveys fail | missing, the surveys disagree, or within ±0.17 pp of the limit |
| Curb ramps (crossings) | both ends lowered, flush or `no` | either end raised | only one end mapped, or none |
| Accessible signal | informational only | — | — |

When a preference is off, its attribute is not checked at all: a
`null` check is skipped. For example, width is skipped when "avoid narrow
passages" is off.

## 2. Each segment gets one state

- **Barrier:** any checked attribute fails, or a verified hazard sits on the
  segment while "avoid reported obstacles" is on.
- **Reported:** a community report sits on the segment while "avoid reported
  obstacles" is on.
- **Verified:** at least one attribute was checked, and every checked attribute
  passes.
- **No data:** everything else. A segment with no evidence is never verified.

## 3. Each route gets a score

score = Σ length × weight(state)

| State | Weight |
| --- | --- |
| Verified | 1 |
| No data | 1.25, or 1.6 with "prefer verified" |
| Reported | 1.8 |
| Barrier | 6 |

With "prefer shorter", every weight above 1 is halved toward 1. The weights are
a judgement, written down so they can be argued with.

## 4. Routes are ranked

Routes are ordered by these keys, in turn:
1. Compatibility, best first:
   - **Compatible:** no barrier, no unknown.
   - **Unknowns:** no barrier.
   - **Incompatible:** has a barrier.
2. Score.
3. Distance.

A route with a known barrier never outranks a route without one, however short
it is.

## 5. Reasons explain the rank with the same numbers

| Reason | When it appears |
| --- | --- |
| `fewest_barriers` | the route has strictly the fewest barriers |
| `most_verified` | the route has strictly the most verified length |
| `shortest` | the route is strictly the shortest |
| `avoids_steps` | the route has no steps when another route does |
| `has_barriers` | the route has at least one barrier |
| `steepest_section` | a slope check failed; shows the steepest failing value |
| `unknown_kerbs` | some crossings have unknown curb ramps |
| `reported_hazards` | there are community reports on the route |

The client renders these codes as "Why this route?". It never generates prose
of its own.

## Hand review of the shared cases

Every expected value in `scoring-cases.json` was checked by hand before it was
committed:
- A missing surface stays **no data**.
- Slope 5.1% against 4.95%, with a 5% limit, is **no data**: it falls inside the
  measurement error.
- Slopes of 7.4% and 7.2% are a **barrier** at 5% and **verified** at 8.3%.
- Surveys reading 2.0% and 9.0% are **no data**: the two surveys disagree.
- Steps are a **barrier** when avoiding stairs and **verified** otherwise.
- A raised kerb is a **barrier** only when "avoid missing curb ramps" is on.
- For the baseline profile, the route with only unknowns ranks first, above a
  shorter route with steps and a longer route with gravel.
