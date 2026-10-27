# Route ranking & explanations

The backend owns ranking. [`src/features/routing/scoring.ts`](../src/features/routing/scoring.ts) mirrors the documented rules so development fixtures are realistic and so the rules are unit-tested and reviewable ([`scoring.test.ts`](../src/features/routing/scoring.test.ts)).

## Conflicts

A segment conflicts with a preference when:

| Preference | Conflict |
| --- | --- |
| `maxSlopePercent` | a segment's measured max slope exceeds it (unknown slope is *not* a conflict — it's reflected in `unknown` coverage instead) |
| `minWidthCm` | a segment's measured min width is below it |
| `avoidStairs` | an unresolved `stairs` hazard |
| `avoidSteepCurbs` | a `missing_curb_ramp` or `blocked_curb_ramp` hazard |
| `avoidDamagedSurfaces` | `surface: "damaged"` or a `damaged_surface` hazard |
| `avoidNarrowPassages` | a `narrow_passage` hazard |
| `avoidReportedObstacles` | any `reported` (unverified) hazard, plus obstruction/construction/snow/ice/flooding |

Resolved hazards never conflict.

## Compatibility level

1. `conflicts` — at least one conflict sits on a `known_barrier` segment.
2. `partial` — conflicts exist, none on a verified barrier.
3. `insufficient_data` — no conflicts, but more than half the route is `unknown`.
4. `meets` — none of the above. The UI still states that sections without data aren't confirmed accessible.

## Score (lower is better)

```
+1000  per conflict on a verified barrier
+150   per other conflict
+120   per known barrier
+90/35 per unverified report (avoidReportedObstacles on/off)
+500/220 × unknown share (preferVerifiedRoutes on/off)
+160   × reported-unverified share
+distance / 2 (preferShorterRoutes) or / 7
```

The large conflict weight means a route that hits a barrier the person asked to avoid is only suggested when every option does. Unknown data is a real cost, never neutral. Ties break on distance; ranking is deterministic regardless of input order.

## Reasons (shown as "Why this route?")

A reason is attached only if it distinguishes the route from at least one alternative:

- `fewest_known_barriers`, `highest_verified_coverage`, `fewest_unverified_reports`, `shortest_distance`, `most_recent_data`
- `avoids_stairs` — only when the person avoids stairs and another option has them
- `within_slope_preference` — only when another option exceeds the slope limit

`explainRoute()` turns these into structured facts (reasons, whether it's the shortest, extra distance vs the shortest, conflicts, and a compact comparison of the others), which the UI renders in the person's language — e.g. *"Suggested for: fewest known barriers, no stairs and most verified sidewalk. It is 350 m longer than the shortest option."*

## Development fixtures

[`src/api/fixtures/routes.ts`](../src/api/fixtures/routes.ts) generates three structurally different alternatives on a grid rotated 16.5° (downtown Toronto's grid angle), assigns each a "personality" (balanced with a missing curb ramp; shortest with stairs and a steep section; longest and mostly verified), rotates personalities by a seed so the suggestion isn't always the same shape, and then ranks with the real rules. Winter hazards appear only November–April. Fixtures never include street names and only work inside the GTA. Everything is tagged `development_fixture`.
