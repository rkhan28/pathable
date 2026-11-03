# 0001. Pilot data sources and how they become knowledge states

- Status: accepted
- Date: 2026-11-03
- Evidence: [DATA_REPORT.md](../DATA_REPORT.md), `docs/data/reality_check.json`

## Context

PathAble shows four knowledge states for every stretch of a route: known
accessible, known barrier, reported but unverified, and no data. The states are
only honest if each one traces back to a named source, an observation date and
a measured error. Before designing the API or the routing graph, I needed to
know which open datasets exist for North York and how good each one is.

## Options considered

| Source | Considered for | Outcome |
| --- | --- | --- |
| OpenStreetMap (Geofabrik Ontario) | Network geometry, surface, kerbs, tactile paving | **Use.** It has the best sidewalk geometry: 1,386.9 km of separate sidewalks in North York. Surface is tagged on 48.1% of sidewalk length. |
| City Sidewalk Inventory | Presence | **Use**, labelled as traced from 2015 imagery. |
| City Pedestrian Network | Fallback network, crosswalk types | **Use** for conflation checks only. Its presence data is the same 2015 inventory. |
| City topographic sidewalk polygons | Width | **Use** as a gross width *estimate*. Validation is weak (section 4 of the report). |
| City Traffic Signals Tabular | Signals, APS, PXOs | **Use.** Refreshed 2026-10-31. |
| StatCan Canadian Pedestrian Network Database | Width, surface | **Reject.** Its Toronto rows copy the City network, with empty width and material. |
| NRCan HRDEM lidar: TRCA GTA 2023, 1 m | Running slope | **Use** as the primary source. |
| NRCan HRDEM lidar: GTA 2015, 1 m | Slope corroboration | **Use** as an independent check. |
| Ontario DTM (Lidar-Derived), GeoHub | Running slope | **Not needed.** It is the same acquisition through a slower access path. |
| Street-level imagery models (Project Sidewalk, RampNet) | Curb ramps | **Defer** until there is licensed training data ([ML_PLAN.md](../ML_PLAN.md)). |

## Decision

1. **Evidence is per attribute, not per edge.** Each edge stores, for each
   attribute (presence, surface, width, running slope, kerbs, APS, steps):
   - the value;
   - the source id;
   - the observation date;
   - the measurement error where one exists.

   Knowledge state is computed at request time against the person's own
   thresholds. The width sensitivity table in the report shows why: moving the
   minimum width from 1.2 m to 1.5 m changes the corridor's known-accessible
   share from 25.4% to 9.7%.
2. **A measured value near the threshold is no data.**
   - `three_way()` returns *unknown* when a value is within the measured error
     of the person's threshold.
   - The error is 0.12 m for width (median absolute difference against OSM
     tags) and 0.17 percentage points for slope (median difference between the
     two lidar surveys).
3. **Slope counts only when two surveys agree.** Both the 2023 and 2015 terrain
   models must put the edge on the same side of the threshold. Where they
   disagree, the ground has changed or a survey hit a wall, so the edge is no
   data.
4. **Missing never means fine.** An untagged surface, an unknown kerb or a
   missing width each make the edge *no data*, and the edge is never scored
   as accessible.
5. **Barrier beats unknown.** One known failing attribute makes the edge a
   known barrier, even if other attributes are unknown.
6. **Licensing.**
   - Each source carries its own licence:
     - OSM: ODbL 1.0.
     - City of Toronto: Open Government Licence – Toronto.
     - NRCan: Open Government Licence – Canada 2.0.
   - The conflated edge table is a derivative database of OSM. It is published
     under ODbL, with attribution for all three licences on the site and in
     `THIRD_PARTY_NOTICES.md`.
   - Community reports are kept in a separate table and are not merged into
     the OSM-derived database until moderation verifies them.

## Consequences

- About 78% of the corridor shows as **no data** for the baseline profile. The
  product has to make that state useful: explain it, offer the best-known
  alternative, and invite a report. It must not hide it.
- The routing API returns per-attribute evidence alongside each segment's state,
  so the client can explain "why" from the same numbers used to rank.
- Slope cannot ship as "verified" until the 10 field-check sites in the data
  report have readings. Until then the UI labels slope as *"estimated from 2023
  lidar"*.
- Using two lidar surveys doubles the terrain reads per graph build. That is
  acceptable: the corridor builds in about a minute.
