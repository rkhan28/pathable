"""Knowledge-state and ranking rules.

Mirror of apps/web/src/lib/scoring.ts. Both implementations are tested
against contracts/fixtures/scoring-cases.json; change them together.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

Check = Literal["pass", "fail", "unknown"]
State = Literal["verified", "barrier", "unverified", "unknown"]
Compatibility = Literal["compatible", "unknowns", "incompatible"]

SURFACE_PASS = frozenset(
    {"asphalt", "concrete", "concrete:plates", "concrete:lanes", "paving_stones", "paved",
     "tartan", "rubber"}
)  # fmt: skip
SURFACE_FAIL = frozenset(
    {"gravel", "fine_gravel", "dirt", "ground", "grass", "sand", "mud", "earth", "unpaved",
     "compacted", "pebblestone", "woodchips", "sett", "cobblestone", "unhewn_cobblestone",
     "grass_paver", "rock"}
)  # fmt: skip
GOOD_KERBS = frozenset({"lowered", "flush", "no"})

STATE_WEIGHT: dict[State, float] = {"verified": 1, "unknown": 1.25, "unverified": 1.8, "barrier": 6}
UNKNOWN_WEIGHT_PREFER_VERIFIED = 1.6
COMPAT_ORDER: dict[Compatibility, int] = {"compatible": 0, "unknowns": 1, "incompatible": 2}

Evidence = Mapping[str, Any]
Prefs = Mapping[str, Any]


def round_half_away(n: float, digits: int = 0) -> float:
    """Match JavaScript Math.round for non-negative values (half rounds up)."""
    f = 10**digits
    return math.floor(n * f + 0.5) / f


def three_way(value: float | None, threshold: float, margin: float, higher_is_better: bool) -> Check:
    if value is None or not math.isfinite(value):
        return "unknown"
    delta = value - threshold if higher_is_better else threshold - value
    if delta > margin:
        return "pass"
    if delta < -margin:
        return "fail"
    return "unknown"


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def check_evidence(e: Evidence, prefs: Prefs) -> Check | None:
    attr = e["attribute"]
    value = e.get("value")
    if attr == "presence":
        return "unknown" if value is None else ("pass" if value is True else "fail")
    if attr == "steps":
        if value is not True:
            return "pass"
        return "fail" if prefs["avoidStairs"] else "pass"
    if attr == "surface":
        if not isinstance(value, str):
            return "unknown"
        if value in SURFACE_PASS:
            return "pass"
        if value in SURFACE_FAIL:
            return "fail" if prefs["avoidDamagedSurfaces"] else "pass"
        return "unknown"
    if attr == "width":
        if not prefs["avoidNarrow"]:
            return None
        return three_way(_num(value), prefs["minWidthM"], e.get("error", 0), True)
    if attr == "running_slope":
        margin = e.get("error", 0)
        corroboration = e.get("corroboration")
        if not corroboration:
            return "unknown"  # lidar slope only counts when two surveys agree (ADR 0001)
        primary = three_way(_num(value), prefs["maxRunningSlopePct"], margin, False)
        second = three_way(_num(corroboration["value"]), prefs["maxRunningSlopePct"], margin, False)
        return primary if primary == second else "unknown"
    if attr == "kerbs":
        if not prefs["avoidMissingRamps"]:
            return None
        if not isinstance(value, str):
            return "unknown"
        ends = value.split(";")
        if "raised" in ends:
            return "fail"
        return "pass" if len(ends) == 2 and all(k in GOOD_KERBS for k in ends) else "unknown"
    if attr == "aps":
        return None
    raise ValueError(f"unknown attribute {attr}")


def segment_state(segment: Mapping[str, Any], prefs: Prefs, hazards: Iterable[Mapping]) -> State:
    checks = [c for e in segment["evidence"] if (c := check_evidence(e, prefs)) is not None]
    if "fail" in checks:
        return "barrier"
    on_segment = [h for h in hazards if h.get("segmentId") == segment["id"]]
    avoid = prefs["avoidReportedObstacles"]
    if avoid and any(h["status"] == "verified" for h in on_segment):
        return "barrier"
    if avoid and any(h["status"] == "reported" for h in on_segment):
        return "unverified"
    if checks and all(c == "pass" for c in checks):
        return "verified"
    return "unknown"


@dataclass
class RouteScore:
    id: str
    distance_m: float
    states: dict[str, State]
    length_by_state: dict[State, float]
    barrier_count: int
    report_count: int
    compatibility: Compatibility
    score: float
    has_steps: bool
    steepest_fail_pct: float | None
    unknown_kerbs: int
    rank: int = 0
    reasons: list[dict] = field(default_factory=list)


def score_route(route: Mapping[str, Any], prefs: Prefs) -> RouteScore:
    states: dict[str, State] = {}
    length: dict[State, float] = {"verified": 0, "barrier": 0, "unverified": 0, "unknown": 0}
    barrier_count = 0
    previous: State | None = None
    steepest: float | None = None
    unknown_kerbs = 0
    hazards = route.get("hazards", [])
    for seg in route["segments"]:
        state = segment_state(seg, prefs, hazards)
        states[seg["id"]] = state
        length[state] += seg["lengthM"]
        if state == "barrier" and previous != "barrier":
            barrier_count += 1
        previous = state
        for e in seg["evidence"]:
            c = check_evidence(e, prefs)
            v = _num(e.get("value"))
            if e["attribute"] == "running_slope" and c == "fail" and v is not None:
                steepest = max(steepest or 0, v)
            if e["attribute"] == "kerbs" and c == "unknown":
                unknown_kerbs += 1
    unknown_w = UNKNOWN_WEIGHT_PREFER_VERIFIED if prefs["preferVerified"] else STATE_WEIGHT["unknown"]

    def soften(w: float) -> float:
        return 1 + (w - 1) * 0.5 if prefs["preferShorter"] else w

    score = (
        length["verified"] * STATE_WEIGHT["verified"]
        + length["unknown"] * soften(unknown_w)
        + length["unverified"] * soften(STATE_WEIGHT["unverified"])
        + length["barrier"] * soften(STATE_WEIGHT["barrier"])
    )
    if length["barrier"] > 0:
        compat: Compatibility = "incompatible"
    elif length["unknown"] + length["unverified"] > 0:
        compat = "unknowns"
    else:
        compat = "compatible"
    return RouteScore(
        id=route["id"],
        distance_m=route["distanceM"],
        states=states,
        length_by_state=length,
        barrier_count=barrier_count,
        report_count=sum(1 for h in hazards if h["status"] == "reported"),
        compatibility=compat,
        score=round_half_away(score, 1),
        has_steps=any(s["kind"] == "steps" for s in route["segments"]),
        steepest_fail_pct=None if steepest is None else round_half_away(steepest, 1),
        unknown_kerbs=unknown_kerbs,
    )


def rank_routes(routes: list[Mapping[str, Any]], prefs: Prefs) -> list[RouteScore]:
    scored = [score_route(r, prefs) for r in routes]
    order = sorted(scored, key=lambda s: (COMPAT_ORDER[s.compatibility], s.score, s.distance_m))
    many = len(scored) > 1

    def share(s: RouteScore) -> float:
        return s.length_by_state["verified"] / max(s.distance_m, 1)

    min_barriers = min(s.barrier_count for s in scored)
    max_verified = max(share(s) for s in scored)
    min_distance = min(s.distance_m for s in scored)
    any_steps = any(s.has_steps for s in scored)

    def unique(pred) -> bool:
        return sum(1 for s in scored if pred(s)) == 1

    for i, s in enumerate(order):
        reasons: list[dict] = []
        if many and s.barrier_count == min_barriers and unique(lambda o: o.barrier_count == min_barriers):
            reasons.append({"code": "fewest_barriers", "value": s.barrier_count})
        if many and share(s) == max_verified and share(s) > 0 and unique(lambda o: share(o) == max_verified):
            reasons.append({"code": "most_verified", "value": round_half_away(share(s) * 100)})
        if many and s.distance_m == min_distance and unique(lambda o: o.distance_m == min_distance):
            reasons.append({"code": "shortest", "value": round_half_away(s.distance_m)})
        if any_steps and not s.has_steps:
            reasons.append({"code": "avoids_steps"})
        if s.barrier_count > 0:
            reasons.append({"code": "has_barriers", "value": s.barrier_count})
        if s.steepest_fail_pct is not None:
            reasons.append({"code": "steepest_section", "value": s.steepest_fail_pct})
        if s.unknown_kerbs > 0:
            reasons.append({"code": "unknown_kerbs", "value": s.unknown_kerbs})
        if s.report_count > 0:
            reasons.append({"code": "reported_hazards", "value": s.report_count})
        s.rank = i + 1
        s.reasons = reasons
    return order
