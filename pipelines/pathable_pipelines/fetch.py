"""Download external datasets and record provenance in a manifest.

Usage: uv run python -m pathable_pipelines.fetch [--data-dir ../data]

The manifest (``raw/manifest.json``) records the publisher metadata at fetch
time: licence, last refresh, resource URL, byte size and SHA-256. Re-running
skips files whose checksum and publisher refresh date are unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

from .sources import TORONTO_CKAN, TORONTO_SOURCES, CkanSource


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve(client: httpx.Client, source: CkanSource) -> dict:
    resp = client.get(f"{TORONTO_CKAN}/package_show", params={"id": source.package_id})
    resp.raise_for_status()
    pkg = resp.json()["result"]
    matches = [r for r in pkg["resources"] if r["name"] == source.resource_name]
    if not matches:
        names = ", ".join(r["name"] for r in pkg["resources"])
        raise LookupError(f"{source.package_id}: no resource {source.resource_name!r} ({names})")
    res = matches[0]
    return {
        "package_id": source.package_id,
        "title": pkg["title"],
        "licence": pkg.get("license_title"),
        "publisher": pkg.get("owner_division"),
        "last_refreshed": pkg.get("last_refreshed"),
        "refresh_rate": pkg.get("refresh_rate"),
        "resource_name": res["name"],
        "resource_format": res.get("format"),
        "resource_url": res["url"],
        "resource_last_modified": res.get("last_modified"),
        "purpose": source.purpose,
    }


def download(client: httpx.Client, url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    with client.stream("GET", url) as resp:
        resp.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in resp.iter_bytes(1 << 20):
                fh.write(chunk)
    tmp.replace(dest)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-dir", type=Path, default=Path(__file__).resolve().parents[2] / "data"
    )
    args = parser.parse_args()
    raw = args.data_dir / "raw" / "toronto"
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = args.data_dir / "raw" / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    with httpx.Client(timeout=httpx.Timeout(60, read=600), follow_redirects=True) as client:
        for source in TORONTO_SOURCES:
            meta = resolve(client, source)
            suffix = Path(meta["resource_url"]).suffix or ".bin"
            dest = raw / f"{source.key}{suffix}"
            previous = manifest.get(source.key, {})
            unchanged = (
                dest.exists()
                and previous.get("last_refreshed") == meta["last_refreshed"]
                and previous.get("sha256") == sha256(dest)
            )
            if not unchanged:
                print(f"fetch {source.key} <- {meta['resource_url']}")
                download(client, meta["resource_url"], dest)
            meta.update(
                file=str(dest.relative_to(args.data_dir)),
                bytes=dest.stat().st_size,
                sha256=sha256(dest),
                fetched_at=previous.get("fetched_at")
                if unchanged
                else datetime.now(UTC).isoformat(),
            )
            manifest[source.key] = meta
            print(
                f"ok    {source.key}: {meta['bytes']:,} bytes, refreshed {meta['last_refreshed']}"
            )

    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
