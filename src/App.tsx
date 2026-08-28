import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from './components/Card'
import Facets from './components/Facets'
import FetchPanel from './components/FetchPanel'
import Lightbox from './components/Lightbox'
import { api } from './lib/api'
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

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('collection')
  const [collections, setCollections] = useState<Set<string>>(new Set())
  const [artists, setArtists] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    try {
      setLibrary(await api.library())
      setError('')
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // `/` jumps to search from anywhere; Esc backs out of whatever is focused.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
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
      <header className="border-ink-800 bg-ink-950/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-5 py-3">
          <div className="mr-2">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              NTP Gallery
            </h1>
            <p className="text-[11px] text-zinc-500">Chrome / ego 新分頁壁紙庫</p>
          </div>

          <div className="relative min-w-56 flex-1">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋標題、作者、集合…  （按 / 聚焦）"
              className="bg-ink-900 border-ink-800 focus:border-accent w-full rounded-lg border py-2 pr-8 pl-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="清除搜尋"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            排序
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="bg-ink-900 border-ink-800 rounded-md border px-2 py-1.5 text-xs text-zinc-200"
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setFetching(true)}
            className="bg-accent text-ink-950 rounded-lg px-3.5 py-2 text-xs font-semibold transition hover:brightness-110"
          >
            抓圖
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 gap-6 px-5 py-6">
        <aside className="scroll-slim sticky top-[68px] hidden h-[calc(100vh-100px)] w-56 shrink-0 overflow-y-auto lg:block">
          <div className="border-ink-800 mb-6 rounded-lg border px-3 py-2.5">
            <p className="text-xs text-zinc-500">圖庫</p>
            <p className="mt-0.5 text-sm text-zinc-200 tabular-nums">
              {images.length} 張 · {bytes(library?.total_bytes ?? 0)}
            </p>
          </div>

          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setCollections(new Set())
                setArtists(new Set())
                setQuery('')
              }}
              className="border-ink-700 hover:border-accent hover:text-accent mb-5 w-full rounded-md border px-2 py-1.5 text-xs text-zinc-400 transition"
            >
              清除所有篩選
            </button>
          )}

          <Facets
            title="集合"
            facets={collectionFacets}
            selected={collections}
            onToggle={(key) => setCollections((prev) => toggle(prev, key))}
          />
          <Facets
            title="作者"
            facets={artistFacets}
            selected={artists}
            onToggle={(key) => setArtists((prev) => toggle(prev, key))}
          />
        </aside>

        <main className="min-w-0 flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              <p className="font-medium">無法連上後端</p>
              <p className="mt-1 text-xs text-red-400/80">{error}</p>
              <p className="mt-2 font-mono text-xs text-red-400/60">python3 api/server.py</p>
            </div>
          )}

          <p className="mb-3 text-xs text-zinc-500 tabular-nums">
            顯示 {visible.length} / {images.length} 張 · {bytes(visibleBytes)}
          </p>

          {visible.length === 0 ? (
            <div className="border-ink-800 rounded-xl border border-dashed px-6 py-20 text-center">
              <p className="text-sm text-zinc-400">
                {images.length === 0 ? '圖庫是空的' : '沒有符合條件的圖片'}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {images.length === 0 ? '點右上「抓圖」下載一個集合' : '換個關鍵字或清除篩選'}
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

      {lightbox !== null && (
        <Lightbox
          images={visible as LocalImage[]}
          index={Math.min(lightbox, visible.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {fetching && (
        <FetchPanel onClose={() => setFetching(false)} onLibraryChanged={() => void reload()} />
      )}
    </div>
  )
}
