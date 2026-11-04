"""Step grouping: what the directions list says, before any text is attached."""

from pathable_api.routing import build_steps, group_steps


def seg(i: int, name: str | None, length: float, kind: str = "sidewalk") -> dict:
    return {
        "id": f"s{i}",
        "kind": kind,
        "streetName": name,
        "lengthM": length,
        "from": i,
        "to": i + 1,
        "evidence": [],
        "state": "unknown",
    }


def names(groups: list[dict]) -> list[tuple[str | None, bool]]:
    return [(g["name"], g["crossing"]) for g in groups]


def test_consecutive_segments_on_one_street_are_one_step():
    groups = group_steps([seg(0, "Keele Street", 50), seg(1, "Keele Street", 60), seg(2, "Finch Avenue West", 80)])
    assert names(groups) == [("Keele Street", False), ("Finch Avenue West", False)]


def test_a_short_side_street_name_between_one_street_is_absorbed():
    groups = group_steps(
        [seg(0, "Ian Macdonald Boulevard", 5), seg(1, "Fine Arts Road", 20), seg(2, "Ian Macdonald Boulevard", 150)]
    )
    assert names(groups) == [("Ian Macdonald Boulevard", False)]
    assert sum(s["lengthM"] for s in groups[0]["segs"]) == 175


def test_a_long_stretch_under_another_name_is_kept():
    groups = group_steps([seg(0, "A Street", 50), seg(1, "B Street", 60), seg(2, "A Street", 50)])
    assert names(groups) == [("A Street", False), ("B Street", False), ("A Street", False)]


def test_a_stub_after_a_crossing_joins_the_next_step_and_keeps_its_turn_point():
    groups = group_steps(
        [
            seg(0, "Path", 40),
            seg(1, "Murray Ross Parkway", 15, "crossing"),
            seg(2, "Trail", 5),
            seg(3, "Columbia Gate", 125),
        ]
    )
    assert names(groups) == [("Path", False), ("Murray Ross Parkway", True), ("Columbia Gate", False)]
    assert groups[2]["anchor"] == 1


def test_the_corner_after_a_crossing_is_not_a_step():
    groups = group_steps(
        [
            seg(0, "Ian Macdonald Boulevard", 100),
            seg(1, "Fine Arts Road", 18, "crossing"),
            seg(2, "Fine Arts Road", 17),
            seg(3, "Ian Macdonald Boulevard", 144),
        ]
    )
    assert names(groups) == [
        ("Ian Macdonald Boulevard", False),
        ("Fine Arts Road", True),
        ("Ian Macdonald Boulevard", False),
    ]


def test_crossings_are_never_merged_away():
    groups = group_steps([seg(0, "A Street", 50), seg(1, "B Street", 5, "crossing"), seg(2, "A Street", 50)])
    assert names(groups) == [("A Street", False), ("B Street", True), ("A Street", False)]


def test_the_turn_is_measured_where_the_street_changes():
    # North along a path, across a road, 5 m more north on a trail, then east along
    # Columbia Gate: the step is a right turn, not "continue".
    geometry = [[0.0, 0.0], [0.0, 0.0004], [0.0, 0.0005], [0.0, 0.00055], [0.001, 0.00055]]
    segments = [seg(0, "Path", 45), seg(1, "Crossing", 11, "crossing"), seg(2, "Trail", 5), seg(3, "Columbia Gate", 80)]
    steps = build_steps({"geometry": geometry, "segments": segments, "hazards": []}, {"maxRunningSlopePct": 5})
    assert [s["maneuver"] for s in steps] == ["depart", "cross", "turn_right", "arrive"]
    assert steps[2]["streetName"] == "Columbia Gate"
    assert steps[2]["at"] == 2
