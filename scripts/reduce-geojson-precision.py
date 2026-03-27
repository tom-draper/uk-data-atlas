#!/usr/bin/env python3
"""
Reduces coordinate precision in GeoJSON boundary files from ~13 decimal places
to 5 (sub-metre accuracy, more than sufficient for web maps).

Typical result: ~40-50% file size reduction, proportional memory savings.

Usage:
    python3 scripts/reduce-geojson-precision.py [--dry-run]
"""

import json
import os
import sys

PRECISION = 5
BOUNDARY_DIRS = [
    "public/data/boundaries/wards",
    "public/data/boundaries/constituencies",
    "public/data/boundaries/lad",
]
DRY_RUN = "--dry-run" in sys.argv


def round_coords(obj):
    if isinstance(obj, float):
        return round(obj, PRECISION)
    if isinstance(obj, list):
        return [round_coords(x) for x in obj]
    return obj


def process_file(path):
    size_before = os.path.getsize(path)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for feature in data.get("features", []):
        geom = feature.get("geometry")
        if geom and "coordinates" in geom:
            geom["coordinates"] = round_coords(geom["coordinates"])

    if not DRY_RUN:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))

    size_after = len(json.dumps(data, separators=(",", ":")))
    return size_before, size_after


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    total_before = 0
    total_after = 0
    files_processed = 0

    for boundary_dir in BOUNDARY_DIRS:
        dir_path = os.path.join(project_root, boundary_dir)
        if not os.path.isdir(dir_path):
            print(f"Skipping missing directory: {boundary_dir}")
            continue

        for filename in sorted(os.listdir(dir_path)):
            if not filename.endswith(".geojson"):
                continue

            filepath = os.path.join(dir_path, filename)
            print(f"Processing {filename}...", end=" ", flush=True)
            before, after = process_file(filepath)
            saved = before - after
            pct = (saved / before * 100) if before > 0 else 0
            print(f"{before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB  (-{pct:.0f}%)")

            total_before += before
            total_after += after
            files_processed += 1

    print()
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Processed {files_processed} files")
    print(f"Total: {total_before/1024/1024:.1f}MB → {total_after/1024/1024:.1f}MB  "
          f"(saved {(total_before-total_after)/1024/1024:.1f}MB, "
          f"-{(total_before-total_after)/total_before*100:.0f}%)")


if __name__ == "__main__":
    main()
