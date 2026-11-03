# 0004: Transit options from the TTC schedule, single vehicle first

Date: 2026-11-03. Status: accepted.

## Context

People asked whether they should take the bus. A walk of 2 km with an unknown
ramp can be worse than a 6-minute subway ride, and the planner should say so.
The TTC publishes its full schedule as GTFS under the Open Government Licence
– Toronto, including `wheelchair_boarding` for stops and `wheelchair_accessible`
for trips.

## Decision

- Load the schedule for North York plus about 1 km into PostGIS: 4,610 stops,
  161 routes, 66,229 trips, 1.5 million stop times and 1,092 vehicle paths.
  The transit tables take 229 MB with indexes (measured), which is most of a
  0.5 GB free database; a free deployment may need to load fewer weeks of service.
- Plan **walk, one vehicle, walk**. One Dijkstra search from each end over the
  evidence graph prices the walk to every stop within 700 m, so the walks to
  and from stops carry the same four knowledge states as walking routes.
  One SQL query then finds trips running that day that leave a reachable stop
  after you could get there and call at a reachable stop near the end.
- Never offer a stop or trip the schedule marks as not accessible (`2`).
  Mark an option step-free only when the trip and both stops are marked `1`;
  anything else is shown as unknown, never as accessible.
- Draw each ride along the vehicle's own path between the two stops.
- Outside the feed's service dates, `/v1/transit` answers `unavailable`
  rather than guessing times.

## Not done yet

- **Transfers.** York University to Sheppard-Yonge is offered as Line 1 the
  long way round (about 70 minutes), because the faster subway-plus-bus trip
  needs a change. Transfers need elevator status, which the TTC publishes
  separately and which changes daily.
- **Real-time arrivals.** Times are scheduled times, and the UI says so.

## Measured

`/v1/transit` takes 60–190 ms on the three demo trips on a laptop, with the full
North York graph and schedule loaded.
