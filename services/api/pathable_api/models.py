"""Request models. Responses are plain dicts validated against contracts/openapi.json in tests."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

LonLat = tuple[Annotated[float, Field(ge=-180, le=180)], Annotated[float, Field(ge=-90, le=90)]]
HazardKind = Literal[
    "obstacle",
    "surface_damage",
    "construction",
    "missing_ramp",
    "blocked_ramp",
    "snow",
    "ice",
    "steep_change",
]


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    maxRunningSlopePct: float = Field(ge=1, le=15)
    minWidthM: float = Field(ge=0.6, le=3)
    avoidStairs: bool
    avoidMissingRamps: bool
    avoidDamagedSurfaces: bool
    avoidReportedObstacles: bool
    avoidNarrow: bool
    preferVerified: bool
    preferShorter: bool


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origin: LonLat
    destination: LonLat
    preferences: Preferences


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: HazardKind
    location: LonLat
    description: str = Field(max_length=500)
    photoId: str | None = Field(pattern=r"^[0-9a-f]{32}$")
    observedOn: date
