#!/usr/bin/env python3
"""Headless downloader — same engine the web UI drives.

    python3 api/cli.py                       # list collections
    python3 api/cli.py underwater            # fetch one
    python3 api/cli.py all --size 5k         # fetch everything
    python3 api/cli.py --reindex             # backfill metadata only
"""
from __future__ import annotations

import argparse
import sys
import time

import backdrop as bd


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch NTP wallpaper collections")
    parser.add_argument("collections", nargs="*", help="collection ids, or 'all'")
    parser.add_argument("--size", default=bd.DEFAULT_SIZE, choices=list(bd.SIZES))
    parser.add_argument("--reindex", action="store_true", help="only backfill metadata")
    parser.add_argument("--fix-ext", action="store_true",
                        help="rename files whose extension disagrees with their bytes")
    args = parser.parse_args()

    if args.fix_ext:
        for before, after in bd.fix_extensions():
            print(f"  {before} -> {after}")
        return 0

    if args.reindex:
        print(f"backfilled {bd.reindex_metadata()} image(s)")
        return 0

    try:
        available = bd.fetch_collections()
    except Exception as exc:                                   # noqa: BLE001
        print(f"backdrop unreachable: {exc}", file=sys.stderr)
        return 1

    if not args.collections:
        library = bd.build_library(make_thumbs=False)
        have: dict[str, int] = {}
        for item in library:
            have[item.collection_id] = have.get(item.collection_id, 0) + 1
        print("Collections:")
        for collection in available:
            print(f"  {collection.id:34} {collection.name:38} local:{have.get(collection.id, 0)}")
        print("\nUsage: cli.py <collection_id> [...] | all  [--size 1080p|4k|5k]")
        return 0

    wanted = [c.id for c in available] if args.collections == ["all"] else args.collections
    known = {c.id for c in available}
    for cid in wanted:
        if cid not in known:
            print(f"unknown collection: {cid}", file=sys.stderr)
            return 1

    for cid in wanted:
        job = bd.REGISTRY.start(cid, args.size)
        seen = 0
        while job.status == "running" or job.finished_at is None:
            while seen < len(job.log):
                print(f"  {job.log[seen]}", flush=True)
                seen += 1
            time.sleep(0.2)
        while seen < len(job.log):
            print(f"  {job.log[seen]}", flush=True)
            seen += 1
        print(f"{job.collection_name}: {job.done} new, {job.skipped} skipped, {job.failed} failed", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
