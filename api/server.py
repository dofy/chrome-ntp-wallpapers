#!/usr/bin/env python3
"""Local sidecar for ntp-gallery.

Serves the wallpaper library metadata, the image/thumbnail bytes, and proxies the
Google Backdrop API (which the browser cannot call directly — no CORS headers).

    python3 api/server.py [--port 8787]
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import posixpath
import threading
import time
import urllib.parse
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import backdrop as bd

CACHE_TTL = 300.0
_cache: dict[str, tuple[float, object]] = {}
_cache_lock = threading.Lock()

# Set from --static in main(). In dev, Vite serves the app and proxies here; in
# production there is no Vite, so the sidecar serves the built bundle itself and
# the whole thing is one process behind one port.
STATIC_DIR: str | None = None


def cached(key: str, producer):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_TTL:
            return hit[1]
    value = producer()
    with _cache_lock:
        _cache[key] = (now, value)
    return value


def drop_cache(prefix: str = "") -> None:
    with _cache_lock:
        for key in [k for k in _cache if k.startswith(prefix)]:
            del _cache[key]


class Handler(BaseHTTPRequestHandler):
    server_version = "ntp-gallery"
    protocol_version = "HTTP/1.1"

    # ---------------------------------------------------------------- output
    def _send(self, status: int, body: bytes, ctype: str, extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, payload, status: int = 200) -> None:
        self._send(status, json.dumps(payload, ensure_ascii=False).encode(),
                   "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def _error(self, status: int, message: str) -> None:
        self._json({"error": message}, status)

    def _file(self, root: str, rel: str, cache: str) -> None:
        # Decode BEFORE the traversal check: filenames carry CJK (artist names
        # such as "木内達朗"), so the browser sends them percent-encoded, and a
        # check run on the encoded form would also miss a "%2e%2e" escape.
        decoded = urllib.parse.unquote(rel, errors="replace")
        safe = posixpath.normpath("/" + decoded).lstrip("/")
        path = os.path.join(root, *safe.split("/"))
        if not os.path.abspath(path).startswith(os.path.abspath(root) + os.sep):
            return self._error(403, "path escapes root")
        if not os.path.isfile(path):
            return self._error(404, "not found")
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        size = os.path.getsize(path)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", cache)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(path, "rb") as fh:
            while chunk := fh.read(256 * 1024):
                self.wfile.write(chunk)

    def _static(self, path: str) -> None:
        """Serve the built frontend out of STATIC_DIR.

        Anything that is not a real file falls back to index.html so a hard
        refresh on a client-side route still boots the app.
        """
        assert STATIC_DIR is not None
        rel = urllib.parse.unquote(path).lstrip("/") or "index.html"
        safe = posixpath.normpath("/" + rel).lstrip("/") or "index.html"
        candidate = os.path.join(STATIC_DIR, *safe.split("/"))
        if os.path.isdir(candidate):
            safe = posixpath.join(safe, "index.html")
            candidate = os.path.join(candidate, "index.html")
        if not os.path.isfile(candidate):
            safe = "index.html"
        # Vite content-hashes everything under assets/, so those are immutable;
        # index.html points at them by name and must never be cached.
        cache = ("public, max-age=31536000, immutable"
                 if safe.startswith("assets/") else "no-store")
        return self._file(STATIC_DIR, safe, cache)

    # ---------------------------------------------------------------- routing
    def do_OPTIONS(self) -> None:                              # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self) -> None:                                 # noqa: N802
        self.do_GET()

    def do_GET(self) -> None:                                  # noqa: N802
        url = urllib.parse.urlparse(self.path)
        path, query = url.path, urllib.parse.parse_qs(url.query)

        if path.startswith("/images/"):
            return self._file(bd.IMAGES_DIR, path[len("/images/"):], "public, max-age=86400")
        if path.startswith("/thumbs/"):
            return self._file(bd.THUMBS_DIR, path[len("/thumbs/"):], "public, max-age=86400")

        if path == "/api/health":
            return self._json({"ok": True, "sizes": list(bd.SIZES), "root": bd.ROOT})

        if path == "/api/collections":
            fresh = query.get("refresh", ["0"])[0] == "1"
            if fresh:
                drop_cache("collections")
            try:
                remote = cached("collections", bd.fetch_collections)
            except Exception as exc:                           # noqa: BLE001
                remote = bd.cached_collections()
                if not remote:
                    return self._error(502, f"backdrop unreachable: {exc}")
            counts: dict[str, int] = {}
            for item in bd.build_library(make_thumbs=False):
                counts[item.collection_id] = counts.get(item.collection_id, 0) + 1
            return self._json([
                {**asdict(c), "downloaded": counts.get(c.id, 0)} for c in remote
            ])

        if path.startswith("/api/collections/") and path.endswith("/images"):
            cid = path[len("/api/collections/"):-len("/images")]
            try:
                images = cached(f"images:{cid}", lambda: bd.fetch_collection_images(cid))
            except Exception as exc:                           # noqa: BLE001
                return self._error(502, f"backdrop unreachable: {exc}")
            return self._json([asdict(i) for i in images])

        if path == "/api/library":
            library = bd.build_library()
            return self._json({
                "images": [asdict(i) for i in library],
                "total_bytes": sum(i.bytes for i in library),
                "collections": sorted({i.collection_id for i in library}),
                "artists": sorted({i.artist for i in library if i.artist}),
            })

        if path == "/api/jobs":
            return self._json({"jobs": bd.REGISTRY.snapshot(), "active": bd.REGISTRY.active()})

        if STATIC_DIR and not path.startswith("/api/"):
            return self._static(path)

        return self._error(404, f"no route for GET {path}")

    def do_POST(self) -> None:                                 # noqa: N802
        url = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return self._error(400, "invalid JSON body")

        if url.path == "/api/fetch":
            cid = (body.get("collection_id") or "").strip()
            if not cid:
                return self._error(400, "collection_id is required")
            job = bd.REGISTRY.start(cid, body.get("size") or bd.DEFAULT_SIZE)
            return self._json(asdict(job), 202)

        if url.path == "/api/jobs/cancel":
            ok = bd.REGISTRY.cancel((body.get("id") or "").strip())
            return self._json({"cancelled": ok}, 200 if ok else 404)

        if url.path == "/api/reindex":
            filled = bd.reindex_metadata(body.get("collections") or None)
            drop_cache()
            return self._json({"filled": filled})

        return self._error(404, f"no route for POST {url.path}")

    def log_message(self, fmt: str, *args) -> None:
        if "/api/" in self.path:
            print(f"  {self.command} {self.path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="ntp-gallery sidecar")
    parser.add_argument("--port", type=int, default=8791)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--no-reindex", action="store_true",
                        help="skip the startup metadata backfill")
    parser.add_argument("--static", default=os.path.join(bd.ROOT, "dist"),
                        help="built frontend to serve; ignored when absent")
    args = parser.parse_args()

    global STATIC_DIR
    STATIC_DIR = args.static if args.static and os.path.isdir(args.static) else None

    os.makedirs(bd.THUMBS_DIR, exist_ok=True)
    library = bd.build_library(make_thumbs=False)
    print(f"ntp-gallery sidecar  http://{args.host}:{args.port}")
    print(f"  library: {len(library)} images in {bd.IMAGES_DIR}")
    print(f"  static:  {STATIC_DIR or 'disabled (no dist/) - API only'}")

    if not args.no_reindex:
        def warm() -> None:
            try:
                bd.fetch_collections()
                filled = bd.reindex_metadata()
                if filled:
                    print(f"  backfilled metadata for {filled} image(s)")
            except Exception as exc:                           # noqa: BLE001
                print(f"  warm-up skipped: {exc}")
            for item in bd.build_library(make_thumbs=True):
                _ = item
            print("  thumbnails ready")
        threading.Thread(target=warm, daemon=True).start()

    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
