"""Google Chrome / ego new-tab-page Backdrop API client + local library indexer.

Stdlib only. The Backdrop endpoints Chromium uses speak protobuf, but they honour
`?rt=j`, which returns JSON with an XSSI prefix. We hand-encode the tiny request
messages (one length-delimited string field) instead of pulling in protobuf.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.request
from dataclasses import dataclass, asdict, field
from typing import Any, Iterable

BASE = "https://clients3.google.com/cast/chromecast/home/wallpaper"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(ROOT, "images")
DATA_DIR = os.path.join(ROOT, "data")
THUMBS_DIR = os.path.join(DATA_DIR, "thumbs")
META_PATH = os.path.join(DATA_DIR, "meta.json")
COLLECTIONS_CACHE = os.path.join(DATA_DIR, "collections.json")

SIZES = {
    "1080p": "=w1920-h1080-p-k-no-nd-mv",
    "4k": "=w3840-h2160-p-k-no-nd-mv",
    "5k": "=w5120-h2880-p-k-no-nd-mv",
}
DEFAULT_SIZE = "4k"

# Backdrop also publishes flat colour swatches, which carry no artist and are
# not artwork. Hidden from the catalogue so `all` never pulls them back in.
EXCLUDED_COLLECTIONS = frozenset({"solidcolors"})
THUMB_EDGE = 720
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")
XSSI = re.compile(r"^\)\]\}'\s*")


# --------------------------------------------------------------------------- #
# protobuf-lite + transport
# --------------------------------------------------------------------------- #
def _proto_str(field_no: int, value: str) -> bytes:
    """Encode a single length-delimited (wire type 2) string field."""
    raw = value.encode()
    out = bytearray([field_no << 3 | 2])
    n = len(raw)
    while True:  # varint length
        byte = n & 0x7F
        n >>= 7
        out.append(byte | (0x80 if n else 0))
        if not n:
            break
    return bytes(out) + raw


def _post(path: str, body: bytes = b"", timeout: float = 20.0) -> Any:
    req = urllib.request.Request(
        f"{BASE}/{path}?rt=j",
        data=body,
        headers={
            "Content-Type": "application/x-protobuf",
            "User-Agent": "ntp-gallery/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(XSSI.sub("", resp.read().decode()))


# --------------------------------------------------------------------------- #
# models
# --------------------------------------------------------------------------- #
@dataclass
class RemoteImage:
    collection_id: str
    title: str
    artist: str
    source_url: str
    note: str = ""
    raw_title: str = ""      # attribution line 1 verbatim, before any split


@dataclass
class Collection:
    id: str
    name: str
    preview_url: str = ""


@dataclass
class LocalImage:
    id: str                     # "<collection_id>/<filename>"
    collection_id: str
    collection_name: str
    title: str
    artist: str
    file: str                   # url path under /images
    thumb: str                  # url path under /thumbs
    bytes: int
    width: int | None = None
    height: int | None = None
    source_url: str = ""
    note: str = ""
    mtime: float = 0.0


# --------------------------------------------------------------------------- #
# remote reads
# --------------------------------------------------------------------------- #
def fetch_collections(language: str = "en") -> list[Collection]:
    doc = _post("collections", _proto_str(1, language))
    out: list[Collection] = []
    for row in doc[0][0][1]:
        if row[0] in EXCLUDED_COLLECTIONS:
            continue
        images = row[2] if len(row) > 2 and row[2] else []
        preview = images[0][1] if images and len(images[0]) > 1 else ""
        out.append(Collection(id=row[0], name=row[1], preview_url=preview or ""))
    _write_json(COLLECTIONS_CACHE, [asdict(c) for c in out])
    return out


def cached_collections() -> list[Collection]:
    raw = _read_json(COLLECTIONS_CACHE, default=[])
    return [Collection(**c) for c in raw]


def collection_names() -> dict[str, str]:
    return {c.id: c.name for c in cached_collections()}


# Several collections ship no artist field and fold the credit into the title,
# in two different shapes:
#
#   Black Artists   "A Passion by Abelle Hayford"     -> title by artist
#   Latino Artists  "Cecilia Ruiz: Paloma Mensajera"  -> artist: title
#
# Split only when the API gave us nothing, and only when the candidate really
# looks like a person's name, so "Head in the Clouds" survives untouched.
_NAME_TOKEN = re.compile(r"^[^\W\d_][\w'’.\-]*$", re.UNICODE)


def _looks_like_name(value: str) -> bool:
    tokens = value.split()
    if not 1 <= len(tokens) <= 4:
        return False
    return all(_NAME_TOKEN.match(t) and t[:1].isupper() for t in tokens)


def split_credit(raw: str) -> tuple[str, str]:
    """Return (title, artist) — artist is '' when nothing name-shaped is found."""
    title = raw.strip()

    artist, _, rest = title.partition(": ")
    if rest and _looks_like_name(artist):
        return rest.strip(), artist.strip()

    head, sep, tail = title.rpartition(" by ")
    if sep and head and _looks_like_name(tail):
        return head.strip(), tail.strip()

    return title, ''


def fetch_collection_images(collection_id: str) -> list[RemoteImage]:
    doc = _post("collection-images", _proto_str(1, collection_id))
    out: list[RemoteImage] = []
    for row in doc[0][0][1]:
        url = row[1]
        attribution = row[3] or []

        def line(index: int) -> str:
            entry = attribution[index] if len(attribution) > index else None
            return (entry[0] if entry else "") or ""

        raw_title = line(0) or "Untitled"
        artist = re.sub(r"^Artwork by\s+", "", line(1)).strip()
        note = line(2).strip()

        title = raw_title
        if not artist:
            title, artist = split_credit(raw_title)

        out.append(
            RemoteImage(
                collection_id=collection_id,
                title=title,
                artist=artist,
                source_url=url,
                note=note,
                raw_title=raw_title,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def slug(value: str) -> str:
    return re.sub(r"[^\w\-.]+", "_", value).strip("_")[:80] or "untitled"


def _read_json(path: str, default: Any = None) -> Any:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(path: str, payload: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


MAGIC = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
    b"GIF8": "gif",
}


def sniff_ext(path: str, default: str = "bin") -> str:
    """Real container from the file header — Backdrop serves PNG regardless of URL."""
    try:
        with open(path, "rb") as fh:
            head = fh.read(16)
    except OSError:
        return default
    for magic, ext in MAGIC.items():
        if head.startswith(magic):
            return ext
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return default


def image_size(path: str) -> tuple[int | None, int | None]:
    """Width/height for PNG and JPEG without pulling in an image library."""
    kind = sniff_ext(path)
    if kind == "png":
        try:
            with open(path, "rb") as fh:
                header = fh.read(24)
            if header[12:16] != b"IHDR":
                return None, None
            return (
                int.from_bytes(header[16:20], "big"),
                int.from_bytes(header[20:24], "big"),
            )
        except OSError:
            return None, None
    if kind != "jpg":
        return None, None
    return _jpeg_size(path)


def _jpeg_size(path: str) -> tuple[int | None, int | None]:
    """Read width/height straight out of the JPEG SOFn marker."""
    try:
        with open(path, "rb") as fh:
            if fh.read(2) != b"\xff\xd8":
                return None, None
            while True:
                byte = fh.read(1)
                while byte and byte != b"\xff":
                    byte = fh.read(1)
                if not byte:
                    return None, None
                marker = fh.read(1)
                while marker == b"\xff":
                    marker = fh.read(1)
                if not marker:
                    return None, None
                code = marker[0]
                if code == 0x01 or 0xD0 <= code <= 0xD9:
                    continue
                head = fh.read(2)
                if len(head) < 2:
                    return None, None
                seg_len = int.from_bytes(head, "big")
                if 0xC0 <= code <= 0xCF and code not in (0xC4, 0xC8, 0xCC):
                    body = fh.read(5)
                    if len(body) < 5:
                        return None, None
                    return (
                        int.from_bytes(body[3:5], "big"),
                        int.from_bytes(body[1:3], "big"),
                    )
                fh.seek(seg_len - 2, 1)
    except OSError:
        return None, None


_HAS_SIPS = shutil.which("sips") is not None

try:                                        # optional, and only needed off macOS
    from PIL import Image as _PILImage
except ImportError:                         # pragma: no cover - depends on host
    _PILImage = None

_HAS_THUMBNAILER = _HAS_SIPS or _PILImage is not None


def _write_thumb(src: str, dst: str) -> None:
    """Write a THUMB_EDGE-bounded JPEG of `src` to `dst`.

    macOS ships `sips`, which stays the default so existing thumbnails keep
    their exact bytes. Everywhere else (the OpenWrt box, CI) Pillow does the
    same job. Raises if neither is available, so callers can fall back to
    serving the full-size original.
    """
    if _HAS_SIPS:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "72",
             "-Z", str(THUMB_EDGE), src, "--out", dst],
            check=True, capture_output=True, timeout=60,
        )
        return
    if _PILImage is not None:
        with _PILImage.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((THUMB_EDGE, THUMB_EDGE), _PILImage.Resampling.LANCZOS)
            im.save(dst, "JPEG", quality=72, optimize=True)
        return
    raise RuntimeError("no thumbnailer: install Pillow or run on macOS")


def ensure_thumb(collection_id: str, filename: str) -> str:
    """Downscale to THUMB_EDGE. Falls back to the original if that is not possible."""
    src = os.path.join(IMAGES_DIR, collection_id, filename)
    rel = f"{collection_id}/{filename}"
    if not _HAS_THUMBNAILER:
        return f"/images/{rel}"
    thumb_rel = f"{collection_id}/{os.path.splitext(filename)[0]}.jpg"
    dst = os.path.join(THUMBS_DIR, *thumb_rel.split("/"))
    try:
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            return f"/thumbs/{thumb_rel}"
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        _write_thumb(src, dst)
        return f"/thumbs/{thumb_rel}"
    except (subprocess.SubprocessError, OSError, ValueError, RuntimeError):
        return f"/images/{rel}"


FILENAME_RE = re.compile(r"^(?:\d+_)?(?P<title>.+?)(?:_Artwork_by_(?P<artist>.+))?$")


def parse_filename(filename: str) -> tuple[str, str]:
    """Recover title/artist from our own naming scheme as a metadata fallback."""
    stem = os.path.splitext(filename)[0]
    match = FILENAME_RE.match(stem)
    if not match:
        return stem.replace("_", " "), ""
    title = (match.group("title") or "").replace("_", " ").strip()
    artist = (match.group("artist") or "").replace("_", " ").strip()
    return title or stem, artist


# --------------------------------------------------------------------------- #
# metadata store
# --------------------------------------------------------------------------- #
# Reentrant so a caller can hold it across a read-modify-write that also
# calls save_meta() (which locks internally).
_meta_lock = threading.RLock()


def load_meta() -> dict[str, dict[str, str]]:
    return _read_json(META_PATH, default={}) or {}


def save_meta(meta: dict[str, dict[str, str]]) -> None:
    with _meta_lock:
        _write_json(META_PATH, meta)


def merge_meta(updates: dict[str, dict[str, str]]) -> None:
    """Fold `updates` into the store under one lock.

    Jobs run concurrently, so load-modify-save from each thread would lose
    whichever writer finished first. Read and write inside the same lock.
    """
    if not updates:
        return
    with _meta_lock:
        meta = _read_json(META_PATH, default={}) or {}
        meta.update(updates)
        _write_json(META_PATH, meta)


def reindex_metadata(collection_ids: Iterable[str] | None = None) -> int:
    """Backfill title/artist/source_url for images downloaded out-of-band.

    Matches files on disk against the live collection listing by slugified title,
    so wallpapers dropped in by hand still get full attribution.
    """
    meta = load_meta()
    updates: dict[str, dict[str, str]] = {}
    ids = list(collection_ids) if collection_ids else _disk_collections()
    filled = 0
    for cid in ids:
        folder = os.path.join(IMAGES_DIR, cid)
        if not os.path.isdir(folder):
            continue
        pending = [
            f for f in sorted(os.listdir(folder))
            if f.lower().endswith(IMAGE_EXTS)
            and not meta.get(f"{cid}/{f}", {}).get("source_url")
        ]
        if not pending:
            continue
        try:
            remote = fetch_collection_images(cid)
        except Exception:
            continue
        by_slug: dict[str, RemoteImage] = {}
        for item in remote:
            by_slug.setdefault(slug(item.raw_title or item.title), item)
            by_slug.setdefault(slug(item.title), item)
        for filename in pending:
            title, artist = parse_filename(filename)
            match = by_slug.get(slug(title))
            entry = {
                "title": match.title if match else title,
                "artist": match.artist if match else artist,
                "source_url": match.source_url if match else "",
                "note": match.note if match else "",
            }
            updates[f"{cid}/{filename}"] = entry
            filled += 1
    merge_meta(updates)
    return filled


def fix_extensions() -> list[tuple[str, str]]:
    """Rename files whose extension disagrees with their bytes, keeping meta in sync.

    Backdrop hands back PNG for every wallpaper, so anything downloaded by an
    older revision of this tool is sitting on disk as a mislabelled `.jpg`.
    """
    renamed: list[tuple[str, str]] = []
    with _meta_lock:
      meta = load_meta()
      for cid in _disk_collections():
          folder = os.path.join(IMAGES_DIR, cid)
          for filename in sorted(os.listdir(folder)):
              if not filename.lower().endswith(IMAGE_EXTS):
                  continue
              src = os.path.join(folder, filename)
              stem, ext = os.path.splitext(filename)
              real = sniff_ext(src)
              if real == "bin" or ext.lower().lstrip(".") in (real, "jpeg" if real == "jpg" else real):
                  continue
              target = f"{stem}.{real}"
              if os.path.exists(os.path.join(folder, target)):
                  continue
              os.rename(src, os.path.join(folder, target))
              entry = meta.pop(f"{cid}/{filename}", None)
              if entry:
                  meta[f"{cid}/{target}"] = entry
              stale = os.path.join(THUMBS_DIR, cid, f"{stem}.jpg")
              if os.path.exists(stale):
                  os.remove(stale)
              renamed.append((f"{cid}/{filename}", f"{cid}/{target}"))
      if renamed:
          save_meta(meta)
    return renamed


def _disk_collections() -> list[str]:
    if not os.path.isdir(IMAGES_DIR):
        return []
    return sorted(
        d for d in os.listdir(IMAGES_DIR)
        if os.path.isdir(os.path.join(IMAGES_DIR, d))
        and not d.startswith(".")
        and d not in EXCLUDED_COLLECTIONS
    )


# --------------------------------------------------------------------------- #
# library
# --------------------------------------------------------------------------- #
def build_library(make_thumbs: bool = True) -> list[LocalImage]:
    meta = load_meta()
    names = collection_names()
    library: list[LocalImage] = []
    for cid in _disk_collections():
        folder = os.path.join(IMAGES_DIR, cid)
        for filename in sorted(os.listdir(folder)):
            if not filename.lower().endswith(IMAGE_EXTS):
                continue
            path = os.path.join(folder, filename)
            key = f"{cid}/{filename}"
            entry = meta.get(key) or {}
            title, artist = parse_filename(filename)
            width, height = image_size(path)
            library.append(
                LocalImage(
                    id=key,
                    collection_id=cid,
                    collection_name=names.get(cid, cid.replace("_", " ").title()),
                    title=entry.get("title") or title,
                    artist=entry.get("artist") or artist,
                    file=f"/images/{key}",
                    thumb=ensure_thumb(cid, filename) if make_thumbs else f"/images/{key}",
                    bytes=os.path.getsize(path),
                    width=width,
                    height=height,
                    source_url=entry.get("source_url", ""),
                    note=entry.get("note", ""),
                    mtime=os.path.getmtime(path),
                )
            )
    return library


# --------------------------------------------------------------------------- #
# download jobs
# --------------------------------------------------------------------------- #
@dataclass
class Job:
    id: str
    collection_id: str
    collection_name: str
    size: str
    status: str = "running"          # running | done | error | cancelled
    total: int = 0
    done: int = 0
    skipped: int = 0
    failed: int = 0
    current: str = ""
    error: str = ""
    log: list[str] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None


class JobRegistry:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._cancel: set[str] = set()
        self._lock = threading.Lock()
        self._seq = 0

    def snapshot(self) -> list[dict]:
        with self._lock:
            jobs = sorted(self._jobs.values(), key=lambda j: j.started_at, reverse=True)
            return [asdict(j) for j in jobs[:20]]

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            if job_id in self._jobs and self._jobs[job_id].status == "running":
                self._cancel.add(job_id)
                return True
        return False

    def active(self) -> bool:
        with self._lock:
            return any(j.status == "running" for j in self._jobs.values())

    def start(self, collection_id: str, size: str = DEFAULT_SIZE) -> Job:
        with self._lock:
            self._seq += 1
            job_id = f"job-{self._seq}"
            job = Job(
                id=job_id,
                collection_id=collection_id,
                collection_name=collection_names().get(collection_id, collection_id),
                size=size if size in SIZES else DEFAULT_SIZE,
            )
            self._jobs[job_id] = job
        threading.Thread(target=self._run, args=(job,), daemon=True).start()
        return job

    def _run(self, job: Job) -> None:
        try:
            images = fetch_collection_images(job.collection_id)
            job.total = len(images)
            folder = os.path.join(IMAGES_DIR, job.collection_id)
            os.makedirs(folder, exist_ok=True)
            suffix = SIZES[job.size]
            pending_meta: dict[str, dict[str, str]] = {}

            for index, image in enumerate(images, 1):
                if job.id in self._cancel:
                    job.status = "cancelled"
                    break
                stem = f"{index:02d}_{slug(image.title)}"
                if image.artist:
                    stem += f"_Artwork_by_{slug(image.artist)}"
                job.current = stem

                existing = next(
                    (f for f in os.listdir(folder)
                     if os.path.splitext(f)[0] == stem and f.lower().endswith(IMAGE_EXTS)),
                    None,
                )
                if existing and os.path.getsize(os.path.join(folder, existing)) > 0:
                    pending_meta[f"{job.collection_id}/{existing}"] = {
                        "title": image.title,
                        "artist": image.artist,
                        "source_url": image.source_url,
                        "note": image.note,
                    }
                    job.skipped += 1
                    job.log.append(f"skip {existing}")
                    continue

                tmp = os.path.join(folder, f"{stem}.part")
                try:
                    urllib.request.urlretrieve(image.source_url + suffix, tmp)
                    # Backdrop ignores the extension in the URL; trust the bytes.
                    filename = f"{stem}.{sniff_ext(tmp, 'jpg')}"
                    dest = os.path.join(folder, filename)
                    os.replace(tmp, dest)
                    pending_meta[f"{job.collection_id}/{filename}"] = {
                        "title": image.title,
                        "artist": image.artist,
                        "source_url": image.source_url,
                        "note": image.note,
                    }
                    ensure_thumb(job.collection_id, filename)
                    job.done += 1
                    job.log.append(f"ok   {filename} ({os.path.getsize(dest) // 1024} KB)")
                except Exception as exc:                      # noqa: BLE001
                    job.failed += 1
                    job.log.append(f"FAIL {stem}: {exc}")
                finally:
                    if os.path.exists(tmp):
                        os.remove(tmp)

            merge_meta(pending_meta)
            job.current = ""
            if job.status == "running":
                job.status = "error" if job.failed and not job.done else "done"
        except Exception as exc:                              # noqa: BLE001
            job.status = "error"
            job.error = str(exc)
        finally:
            job.finished_at = time.time()
            self._cancel.discard(job.id)


REGISTRY = JobRegistry()
