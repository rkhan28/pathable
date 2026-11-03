"""The shared scoring cases must match this implementation exactly.

The same file is asserted by apps/web/src/lib/scoring.test.ts, which is how
CI proves the backend and the client rank routes identically.
"""

import json
from pathlib import Path

import pytest

from pathable_api.scoring import rank_routes, segment_state

CASES = json.loads((Path(__file__).resolve().parents[3] / "contracts/fixtures/scoring-cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_shared_case(case):
    prefs = case["preferences"]
    if case["kind"] == "segments":
        hazards = case["input"]["hazards"]
        got = {s["id"]: segment_state(s, prefs, hazards) for s in case["input"]["segments"]}
        assert got == case["expected"]
    else:
        got = [
            {
                "id": s.id,
                "rank": s.rank,
                "compatibility": s.compatibility,
                "score": s.score,
                "barrierCount": s.barrier_count,
                "lengthByState": s.length_by_state,
                "reasons": s.reasons,
            }
            for s in rank_routes(case["input"]["routes"], prefs)
        ]
        assert got == case["expected"]


def test_no_data_is_never_verified():
    prefs = CASES[0]["preferences"]
    seg = {"id": "x", "evidence": [{"attribute": "surface", "value": None}]}
    assert segment_state(seg, prefs, []) == "unknown"
    assert segment_state({"id": "y", "evidence": []}, prefs, []) == "unknown"
