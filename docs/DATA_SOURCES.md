# Data sources

Every dataset PathAble reads, where it comes from, and the terms it is used
under. The pipeline re-resolves URLs and refresh dates from each publisher on
every run. It records what it fetched, with a SHA-256 checksum, in
`data/raw/manifest.json`.

| Key | Dataset | Publisher | Licence | Refresh seen 2026-11-03 | Used for |
| --- | --- | --- | --- | --- | --- |
| `osm` | OpenStreetMap, Geofabrik `ontario-latest.osm.pbf` clipped to North York | OpenStreetMap contributors | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | replication 2026-11-01T21:21:36Z | network, surface, kerbs, tactile paving, stations |
| `boundary` | Former Municipality Boundaries | City of Toronto | [OGL – Toronto](https://open.toronto.ca/open-data-license/) | 2026-02-20 | pilot boundary |
| `neighbourhoods` | Neighbourhoods (158) | City of Toronto | OGL – Toronto | 2026-02-20 | per-area reporting |
| `sidewalk_inventory` | Sidewalk Inventory | City of Toronto, Transportation Services | OGL – Toronto | 2019-07-23 (imagery spring 2015) | presence |
| `pednet` | Pedestrian Network | City of Toronto | OGL – Toronto | 2026-02-20 | conflation checks, crosswalk types |
| `sidewalk_polygons` | Topographic Mapping – Physical area of sidewalks | City of Toronto | OGL – Toronto | 2026-02-20 (geometry 2021–2024) | width estimate |
| `traffic_signals` | Traffic Signals Tabular: Traffic Signal | City of Toronto, Transportation Services | OGL – Toronto | 2026-10-31 | signals, accessible pedestrian signals |
| `pedestrian_crossovers` | Traffic Signals Tabular: Pedestrian Crossover | City of Toronto | OGL – Toronto | 2026-10-31 | crossovers |
| `dtm_2023` | HRDEM lidar `TRCA-GTA_2023-1m` | NRCan / TRCA | [OGL – Canada 2.0](https://open.canada.ca/en/open-government-licence-canada) | acquired 2023-05-11 | running slope |
| `dtm_2015` | HRDEM lidar `NRCAN-GTA2015-1m` | NRCan | OGL – Canada 2.0 | acquired 2015-04-25 | slope corroboration |

## Evaluated and not used

- **Canadian Pedestrian Network Database**, Statistics Canada, released
  2025-03-19, OGL – Canada.
  - The Toronto rows are the City's Pedestrian Network as of 2020.
  - All 75,891 rows have empty `width` and `..` for `material`.
  - The archive's SHA-256 was `6f4995eb…a7aa`.
- **Ontario Digital Terrain Model (Lidar-Derived)**, Ontario GeoHub. It is the
  same TRCA acquisition as `dtm_2023`.

## Required attribution

> Contains information licensed under the Open Government Licence – Toronto.
> Contains information licensed under the Open Government Licence – Canada.
> Map data © OpenStreetMap contributors, available under the Open Database Licence.
