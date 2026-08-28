# NTP Gallery

Browse, search and fetch the wallpaper collections that Chrome and ego serve on
`chrome://new-tab-page` / `ego://new-tab-page`.

<img width="900" alt="gallery" src="data/.screenshot.png" />

## Why a sidecar

Chromium fetches new-tab backgrounds from Google's **Backdrop** service:

```
POST https://clients3.google.com/cast/chromecast/home/wallpaper/collections
POST https://clients3.google.com/cast/chromecast/home/wallpaper/collection-images
```

Two things make this awkward from a page:

- The request bodies are protobuf. `?rt=j` flips the *response* to JSON (with a
  `)]}'` XSSI prefix), but the request still needs a hand-rolled message — one
  length-delimited string field, which `api/backdrop.py` encodes directly.
- The endpoints send no CORS headers, so the browser cannot call them at all.

So a small stdlib-only Python sidecar proxies the API, downloads the images, and
serves the bytes. The React app talks only to `/api`.

## Run

```bash
pnpm install
pnpm dev            # sidecar on :8791 + Vite on :5188
```

Then open <http://localhost:5188>.

`pnpm dev:api` / `pnpm dev:web` run the halves separately; `pnpm build && pnpm preview`
serves the built bundle on :5189 with the same proxy table. The sidecar port is
8791 because `*:8787` is a common default elsewhere; override with
`python3 api/server.py --port N` plus `NTP_API=http://127.0.0.1:N pnpm dev:web`.

## Features

| | |
|---|---|
| **浏览** | Lazy-loaded grid of `sips`-generated 720px thumbnails, so a 4K library stays snappy. Click for a full-res lightbox with `←/→` and `Esc`. |
| **抓图** | Side panel lists every remote collection with a local/remote count, a 1080p–5K size picker, live per-file progress, and cancel. Existing files are skipped, so re-running is cheap. |
| **分类** | Facet rails for collection and artist, with counts. Multi-select, combines with search. |
| **查询** | Multi-term substring search over title, artist, collection and path. `/` focuses it from anywhere. |

Sort by collection, title, artist, file size, or most recently added.

## CLI

The web UI and the CLI drive the same engine.

```bash
python3 api/cli.py                      # list collections + local counts
python3 api/cli.py underwater           # fetch one
python3 api/cli.py all --size 5k        # fetch everything at 5120×2880
python3 api/cli.py --reindex            # backfill title/artist/source for stray files
python3 api/cli.py --fix-ext            # rename files whose extension ≠ their bytes
```

## Layout

```
api/
  backdrop.py   Backdrop client, download jobs, thumbnails, library index
  server.py     HTTP sidecar: /api/*, /images/*, /thumbs/*
  cli.py        headless front-end for the same engine
src/            React 19 + Tailwind 4 app
images/         wallpaper bytes            (gitignored)
data/
  meta.json     title / artist / source URL per file   (committed)
  thumbs/       generated thumbnails       (gitignored)
```

`images/` is gitignored — all nine collections are 226 files / ~410 MB at 4K. `data/meta.json` keeps every source URL, so a fresh clone plus one
fetch reproduces the library exactly.

## Notes

- **Backdrop mixes PNG and JPEG** (113/113 across the full catalogue) and ignores
  the extension implied by the URL. Downloads are named from the magic bytes, and
  `--fix-ext` repairs anything an older run mislabelled.
- **Attribution comes in three shapes.** Most collections give a separate artist
  line; Black Artists uses `"<title> by <artist>"` and Latino Artists uses
  `"<artist>: <title>"`, both inside the title field. `split_credit()` unpicks
  those only when no artist was supplied and only when the candidate is
  name-shaped, so `"I Want to Ride My Bicycle"` is left intact. Seascapes adds a
  third line, kept as `note` and included in search.
- Filenames can contain CJK (artist names such as `木内達朗`), so the sidecar
  percent-decodes request paths before the traversal check.
- Thumbnails use macOS `sips`. Without it the grid falls back to full-res images.
- Collection catalogue is currently nine entries; the older Landscapes /
  Cityscapes / Art sets are no longer served.
- Metadata writes are merged under one reentrant lock, so queueing several
  collections at once cannot make one job's entries clobber another's.
- The wallpapers are credited artist works, licensed for use inside Chrome.
  Fine as personal wallpaper — do not redistribute.
