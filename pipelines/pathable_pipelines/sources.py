"""Registry of every external dataset the pipeline reads.

Each entry names the publisher's own identifier so a run can re-resolve the
current download URL, refresh date and licence instead of trusting values
copied into this file. Nothing here asserts what a dataset contains; the
reality-check step measures that.
"""

from __future__ import annotations

from dataclasses import dataclass

TORONTO_CKAN = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action"
OGL_TORONTO = "https://open.toronto.ca/open-data-license/"


@dataclass(frozen=True)
class CkanSource:
    key: str
    package_id: str
    resource_name: str
    purpose: str


TORONTO_SOURCES: tuple[CkanSource, ...] = (
    CkanSource(
        "boundary",
        "former-municipality-boundaries",
        "Former Municipality Boundaries Data - 4326.gpkg",
        "North York pilot boundary (pre-amalgamation municipality)",
    ),
    CkanSource(
        "neighbourhoods",
        "neighbourhoods",
        "Neighbourhoods - 4326.gpkg",
        "158 social-planning neighbourhoods for per-area coverage reporting",
    ),
    CkanSource(
        "sidewalk_inventory",
        "sidewalk-inventory",
        "sidewalk-inventory-wgs84",
        "Sidewalk presence per centreline side",
    ),
    CkanSource(
        "sidewalk_polygons",
        "topographic-mapping-physical-area-of-sidewalks",
        "Sidewalks - 4326.gpkg",
        "Physical sidewalk area; candidate for width estimates",
    ),
    CkanSource(
        "pednet",
        "pedestrian-network",
        "Pedestrian Network Data - 4326.gpkg",
        "City pedestrian network with crossings and signals",
    ),
    CkanSource(
        "traffic_signals",
        "traffic-signals-tabular",
        "Traffic Signal - 4326.gpkg",
        "Signalised intersections, including accessible pedestrian signal fields",
    ),
    CkanSource(
        "pedestrian_crossovers",
        "traffic-signals-tabular",
        "Pedestrian Crossover - 4326.gpkg",
        "Pedestrian crossovers (PXOs)",
    ),
    CkanSource(
        "ttc_gtfs",
        "merged-gtfs-ttc-routes-and-schedules",
        "Complete GTFS",
        "TTC schedule with wheelchair flags, for accessible bus, streetcar, LRT and subway options",
    ),
)

GEOFABRIK_ONTARIO = "https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf"
