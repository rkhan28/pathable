"""Expand contracts/fixtures/scoring-inputs.json into scoring-cases.json.

Expected values come from pathable_api.scoring and are reviewed by hand
(docs/ROUTE_RANKING.md). The web test suite asserts the TypeScript rules
produce the same output, which is what keeps the two in agreement.
"""

from __future__ import annotations

import json
from pathlib import Path

from pathable_api.scoring import rank_routes, segment_state

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "fixtures"


def expand_route(name: str, spec: dict, segments: dict) -> dict:
    segs = []
    for i, key in enumerate(spec["segments"]):
        seg = dict(segments[key])
        seg["id"] = f"{name}-{i}-{seg['id']}"
        segs.append(seg)
    return {"id": name, "distanceM": spec["distanceM"], "segments": segs, "hazards": []}


def main() -> None:
    src = json.loads((FIXTURES / "scoring-inputs.json").read_text())
    out = []
    for case in src["cases"]:
        prefs = src["preferences"][case["preferences"]]
        entry = {"name": case["name"], "kind": case["kind"], "preferences": prefs}
        if case["kind"] == "segments":
            hazards = [src["hazards"][h] for h in case.get("hazards", [])]
            segs = [src["segments"][k] for k in case["segments"]]
            entry["input"] = {"segments": segs, "hazards": hazards}
            entry["expected"] = {s["id"]: segment_state(s, prefs, hazards) for s in segs}
        else:
            routes = [expand_route(r, src["routes"][r], src["segments"]) for r in case["routes"]]
            entry["input"] = {"routes": routes}
            entry["expected"] = [
                {
                    "id": s.id,
                    "rank": s.rank,
                    "compatibility": s.compatibility,
                    "score": s.score,
                    "barrierCount": s.barrier_count,
                    "lengthByState": s.length_by_state,
                    "reasons": s.reasons,
                }
                for s in rank_routes(routes, prefs)
            ]
        out.append(entry)
    (FIXTURES / "scoring-cases.json").write_text(json.dumps(out, indent=1) + "\n")
    for e in out:
        print(e["name"], "->", json.dumps(e["expected"])[:600])


if __name__ == "__main__":
    main()
