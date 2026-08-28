import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from './components/Card'
import FetchPanel from './components/FetchPanel'
import Lightbox from './components/Lightbox'
import Skeleton from './components/Skeleton'
import Splash from './components/Splash'
import Wallpaper, { WallpaperCredit } from './components/Wallpaper'
import FacetRail from './components/FacetRail'
import { ChevronDown, Close, Filter, Search, SortIcon, Sparkle } from './components/Icons'
import { api } from './lib/api'
import { isFetchUnlocked } from './lib/gate'
import { usePresence } from './lib/usePresence'
import { bytes, matches } from './lib/format'
import type { Library, LocalImage, SortKey } from './lib/types'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'collection', label: '集合' },
  { key: 'title', label: '標題' },
  { key: 'artist', label: '作者' },
  { key: 'bytes', label: '檔案大小' },
  { key: 'recent', label: '最近加入' },
]

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set)
  if (!next.delete(key)) next.add(key)
  return next
}

function pick<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null
}

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('collection')
  const [collections, setCollections] = useState<Set<string>>(new Set())
  const [artists, setArtists] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)
  const [backdrop, setBackdrop] = useState<LocalImage | null>(null)
  const [ready, setReady] = useState(false)
  // The splash covers the first paint only. It must not wait for the library
  // request, or it would sit opaque on top of the skeleton grid and make that
  // skeleton unreachable.
  const [mounted, setMounted] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  // Evaluated once: the panel should not appear or vanish on re-render.
  const [fetchUnlocked] = useState(isFetchUnlocked)
  const searchRef = useRef<HTMLInputElement>(null)
  const fetchPresence = usePresence(fetching, 380)
  const lightboxPresence = usePresence(lightbox !== null, 300)
  const [filterSheet, setFilterSheet] = useState(false)
  const sheetPresence = usePresence(filterSheet, 340)
  // Closing sets `lightbox` to null immediately, so the exit animation needs a
  // remembered index to keep rendering the same image while it fades out.
  const lastLightbox = useRef(0)
  if (lightbox !== null) lastLightbox.current = lightbox

  const reload = useCallback(async () => {
    try {
      const next = await api.library()
      setLibrary(next)
      setBackdrop((current) => current ?? pick(next.images))
      setError('')
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const appear = window.setTimeout(() => setMounted(true), 180)
    // Unmount once the fade-out has finished rather than leaving a dead
    // full-screen layer in the tree.
    const remove = window.setTimeout(() => setSplashGone(true), 900)
    return () => {
      window.clearTimeout(appear)
      window.clearTimeout(remove)
    }
  }, [])

  // `/` jumps to search from anywhere; Esc backs out of whatever is focused.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape' && typing) searchRef.current?.blur()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const images = library?.images ?? []

  const collectionFacets = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>()
    for (const image of images) {
      const entry = map.get(image.collection_id) ?? { label: image.collection_name, count: 0 }
      entry.count += 1
      map.set(image.collection_id, entry)
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [images])

  const artistFacets = useMemo(() => {
    const map = new Map<string, number>()
    for (const image of images) {
      const key = image.artist || '未署名'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [images])

  const visible = useMemo(() => {
    const filtered = images.filter((image) => {
      if (collections.size && !collections.has(image.collection_id)) return false
      if (artists.size && !artists.has(image.artist || '未署名')) return false
      return matches(
        [image.title, image.artist, image.collection_name, image.note, image.id],
        query,
      )
    })
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'artist':
          return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
        case 'bytes':
          return b.bytes - a.bytes
        case 'recent':
          return b.mtime - a.mtime
        default:
          return a.collection_name.localeCompare(b.collection_name) || a.id.localeCompare(b.id)
      }
    })
    return sorted
  }, [images, collections, artists, query, sort])

  const filtersOn = collections.size > 0 || artists.size > 0 || query.length > 0
  const visibleBytes = visible.reduce((sum, image) => sum + image.bytes, 0)

  return (
    <div className="flex min-h-screen flex-col">
      {!splashGone && <Splash leaving={mounted} />}
      <Wallpaper image={backdrop} onShuffle={() => setBackdrop(pick(images))} />

      <header className="glass-strong slide-down sticky top-0 z-30 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:gap-x-3 sm:px-5 sm:py-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-9 shrink-0 drop-shadow-sm" />
            {/* The wordmark is the first thing to go when width is scarce; the
                favicon still identifies the page. */}
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-sm font-bold tracking-tight">NTP Gallery</h1>
              <p className="text-ink-faint truncate text-[11px]">藝術家壁紙收藏</p>
            </div>
          </div>

          {/* Search drops to its own full-width row below sm rather than being
              squeezed to a few characters. */}
          <div className="relative order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <Search className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋標題、作者、集合…"
              className="glass-chip tx focus:border-mint focus:ring-mint-wash placeholder:text-ink-faint w-full rounded-full border border-white/60 py-2 pr-9 pl-9 text-sm focus:ring-4 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清除搜尋"
              tabIndex={query ? 0 : -1}
              className={`tx text-ink-faint hover:text-peach-deep absolute top-1/2 right-3 -translate-y-1/2 ${
                query ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'
              }`}
            >
              <Close />
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
            {/* Facets live in the rail on wide screens and in a sheet below it,
                so small screens keep the collection and artist filters. */}
            <button
              type="button"
              onClick={() => setFilterSheet(true)}
              aria-label="篩選"
              className={`glass-chip tx hover:border-mint hover:text-mint-deep relative flex items-center gap-1.5 rounded-full border border-white/60 px-3 py-2 text-xs lg:hidden ${
                filtersOn ? 'text-mint-deep border-mint' : 'text-ink-soft'
              }`}
            >
              <Filter className="size-4" />
              {filtersOn && <span className="bg-peach size-1.5 rounded-full" />}
            </button>

            <label className="text-ink-faint flex items-center gap-1.5 text-xs">
              <SortIcon className="hidden size-4 sm:block" />
              <span className="relative">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  aria-label="排序方式"
                  className="glass-chip tx hover:border-mint text-ink cursor-pointer appearance-none rounded-full border border-white/60 py-2 pr-7 pl-3 text-xs"
                >
                  {SORTS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-ink-faint pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
              </span>
            </label>

            {fetchUnlocked && (
              <button
                type="button"
                onClick={() => setFetching(true)}
                className="bg-peach hover:bg-peach-deep tx flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white shadow-sm hover:scale-105 hover:shadow-md"
              >
                <Sparkle className="size-4" />
                <span className="hidden sm:inline">抓圖</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 gap-6 px-5 py-6">
        <aside className="glass rounded-blob rise sticky top-[84px] hidden h-[calc(100vh-150px)] w-60 shrink-0 flex-col overflow-hidden p-4 lg:flex">
          <FacetRail
            imageCount={images.length}
            totalBytes={library?.total_bytes ?? 0}
            collectionFacets={collectionFacets}
            artistFacets={artistFacets}
            collections={collections}
            artists={artists}
            filtersOn={filtersOn}
            onToggleCollection={(key) => setCollections((prev) => toggle(prev, key))}
            onToggleArtist={(key) => setArtists((prev) => toggle(prev, key))}
            onClear={() => {
              setCollections(new Set())
              setArtists(new Set())
              setQuery('')
            }}
          />
        </aside>

        <main className="min-w-0 flex-1">
          {error && (
            <div className="rounded-blob mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <p className="font-semibold">無法連上後端</p>
              <p className="mt-1 text-xs text-red-500">{error}</p>
              <p className="mt-2 font-mono text-xs text-red-400">python3 api/server.py</p>
            </div>
          )}

          <p className="glass-chip text-ink-soft mb-3 inline-flex rounded-full px-3 py-1 text-xs tabular-nums transition-all duration-300">
            顯示 {visible.length} / {images.length} 張 · {bytes(visibleBytes)}
          </p>

          {!ready ? (
            <Skeleton />
          ) : visible.length === 0 ? (
            <div className="glass rounded-blob border-dashed px-6 py-20 text-center">
              <p className="text-ink-soft text-sm">
                {images.length === 0 ? '圖庫是空的' : '沒有符合條件的圖片'}
              </p>
              <p className="text-ink-faint mt-1 text-xs">
                {images.length > 0
                  ? '換個關鍵字或清除篩選'
                  : fetchUnlocked
                    ? '點右上「抓圖」下載一個集合'
                    : '執行 python3 api/cli.py all 下載壁紙'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((image, index) => (
                <Card key={image.id} image={image} onOpen={() => setLightbox(index)} />
              ))}
            </div>
          )}
        </main>
      </div>

      <footer className="glass-strong slide-down sticky bottom-0 z-20 rounded-none border-x-0 border-b-0">
        <div className="text-ink-faint mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-5 py-3 text-[11px]">
          <WallpaperCredit image={backdrop} onShuffle={() => setBackdrop(pick(images))} />
          <span>
            © {new Date().getFullYear()}{' '}
            <a
              href="https://ntp.phpz.org"
              target="_blank"
              rel="noreferrer"
              className="tx hover:text-mint-deep font-medium underline decoration-dotted underline-offset-2"
            >
              ntp.phpz.org
            </a>
          </span>
        </div>
      </footer>

      {lightboxPresence.mounted && visible.length > 0 && (
        <Lightbox
          open={lightbox !== null}
          images={visible as LocalImage[]}
          index={Math.min(lightbox ?? lastLightbox.current, visible.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {sheetPresence.mounted && (
        <div
          className={`overlay fixed inset-0 z-40 flex items-end lg:hidden ${
            sheetPresence.visible ? 'bg-ink/25 opacity-100 backdrop-blur-sm' : 'bg-ink/0 opacity-0'
          }`}
          onClick={() => setFilterSheet(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="篩選"
            className={`glass-solid drawer flex max-h-[78vh] w-full flex-col rounded-t-[2rem] rounded-b-none border-x-0 border-b-0 p-4 ${
              sheetPresence.visible ? 'translate-y-0' : 'translate-y-full'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="text-sm font-bold">篩選</h2>
              <button
                type="button"
                onClick={() => setFilterSheet(false)}
                aria-label="關閉"
                className="tx hover:bg-peach/20 hover:text-peach-deep text-ink-soft rounded-full p-2 hover:rotate-90"
              >
                <Close className="size-5" />
              </button>
            </div>
            <FacetRail
            imageCount={images.length}
            totalBytes={library?.total_bytes ?? 0}
            collectionFacets={collectionFacets}
            artistFacets={artistFacets}
            collections={collections}
            artists={artists}
            filtersOn={filtersOn}
            onToggleCollection={(key) => setCollections((prev) => toggle(prev, key))}
            onToggleArtist={(key) => setArtists((prev) => toggle(prev, key))}
            onClear={() => {
              setCollections(new Set())
              setArtists(new Set())
              setQuery('')
            }}
            />
          </div>
        </div>
      )}

      {fetchUnlocked && fetchPresence.mounted && (
        <FetchPanel
          open={fetching}
          onClose={() => setFetching(false)}
          onLibraryChanged={() => void reload()}
        />
      )}
    </div>
  )
}
