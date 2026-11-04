"""A build's version names its inputs: same data, same version; new data, new version."""

import os

from pathable_pipelines import export_graph


def test_version_follows_the_inputs(tmp_path, monkeypatch):
    (tmp_path / "osm").mkdir()
    extract = tmp_path / "osm" / "ontario-latest.osm.pbf"
    extract.write_bytes(b"osm")
    os.utime(extract, (1_793_707_200, 1_793_707_200))  # 2026-11-03 12:00 UTC
    (tmp_path / "signals.csv").write_text("a\n")
    (tmp_path / "osm" / "ontario-latest.osm.pbf.md5").write_text("ignored")
    monkeypatch.setattr(export_graph, "RAW", tmp_path)

    first = export_graph.data_version("corridor")
    assert first.startswith("corridor-2026-11-03-")
    assert export_graph.data_version("corridor") == first  # re-running replaces, not duplicates

    (tmp_path / "osm" / "ontario-latest.osm.pbf.md5").write_text("checksums do not count")
    assert export_graph.data_version("corridor") == first

    (tmp_path / "signals.csv").write_text("a\nb\n")  # a refreshed City dataset
    assert export_graph.data_version("corridor") != first
