import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Job, RemoteCollection } from '../lib/types'

const SIZES = [
  { key: '1080p', label: '1920×1080' },
  { key: '4k', label: '3840×2160' },
  { key: '5k', label: '5120×2880' },
]

interface Props {
  onClose: () => void
  onLibraryChanged: () => void
}

export default function FetchPanel({ onClose, onLibraryChanged }: Props) {
  const [collections, setCollections] = useState<RemoteCollection[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [size, setSize] = useState('4k')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadCollections(refresh = false) {
    setLoading(true)
    try {
      setCollections(await api.collections(refresh))
      setError('')
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCollections()
  }, [])

  // Poll while anything is running; back off to idle once the queue drains so a
  // parked panel is not hammering the sidecar.
  useEffect(() => {
    let timer: number | undefined
    let cancelled = false

    async function tick() {
      try {
        const snapshot = await api.jobs()
        if (cancelled) return
        setJobs(snapshot.jobs)
        if (!snapshot.active && snapshot.jobs.some((j) => j.status === 'done')) {
          onLibraryChanged()
          void loadCollections()
        }
        timer = window.setTimeout(tick, snapshot.active ? 600 : 4000)
      } catch {
        if (!cancelled) timer = window.setTimeout(tick, 4000)
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start(id: string) {
    try {
      await api.fetchCollection(id, size)
      setJobs(await api.jobs().then((s) => s.jobs))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  const running = jobs.filter((j) => j.status === 'running')

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-ink-900 border-ink-800 flex h-full w-full max-w-xl flex-col border-l shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-ink-800 flex items-center gap-3 border-b px-5 py-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-zinc-100">抓圖</h2>
            <p className="text-xs text-zinc-500">
              直接讀 Google Backdrop API，已存在的檔案自動跳過
            </p>
          </div>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className="bg-ink-800 border-ink-700 rounded-md border px-2 py-1.5 text-xs text-zinc-200"
          >
            {SIZES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="hover:bg-ink-800 rounded-md px-2 py-1 text-lg leading-none text-zinc-400 transition"
          >
            ✕
          </button>
        </header>

        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {loading && collections.length === 0 ? (
            <p className="text-sm text-zinc-500">載入集合列表…</p>
          ) : (
            <ul className="space-y-2">
              {collections.map((collection) => {
                const active = running.find((j) => j.collection_id === collection.id)
                return (
                  <li
                    key={collection.id}
                    className="border-ink-800 bg-ink-950/40 flex items-center gap-3 rounded-lg border p-3"
                  >
                    {collection.preview_url && (
                      <img
                        src={`${collection.preview_url}=w160-h90-p-k-no-nd-mv`}
                        alt=""
                        loading="lazy"
                        className="bg-ink-800 h-12 w-20 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{collection.name}</p>
                      <p className="truncate font-mono text-[11px] text-zinc-600">{collection.id}</p>
                      {active ? (
                        <Progress job={active} />
                      ) : (
                        <p className="mt-1 text-xs text-zinc-500">
                          本地已有 <span className="tabular-nums text-zinc-300">{collection.downloaded}</span> 張
                        </p>
                      )}
                    </div>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => void api.cancelJob(active.id)}
                        className="shrink-0 rounded-md border border-red-900 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-950/50"
                      >
                        取消
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void start(collection.id)}
                        className="border-ink-700 hover:border-accent hover:text-accent shrink-0 rounded-md border px-2.5 py-1.5 text-xs text-zinc-200 transition"
                      >
                        抓取
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {jobs.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                任務紀錄
              </h3>
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.id} className="border-ink-800 bg-ink-950/40 rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusDot status={job.status} />
                      <span className="flex-1 truncate text-zinc-300">{job.collection_name}</span>
                      <span className="tabular-nums text-zinc-500">
                        {job.done} 新增 · {job.skipped} 跳過
                        {job.failed > 0 && ` · ${job.failed} 失敗`}
                      </span>
                    </div>
                    {job.error && <p className="mt-1 text-xs text-red-400">{job.error}</p>}
                    {job.log.length > 0 && (
                      <pre className="scroll-slim mt-2 max-h-28 overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-600">
                        {job.log.slice(-40).join('\n')}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="border-ink-800 flex items-center gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={() => void loadCollections(true)}
            className="border-ink-700 hover:border-accent hover:text-accent rounded-md border px-3 py-1.5 text-xs text-zinc-300 transition"
          >
            重新載入集合
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.reindex()
              onLibraryChanged()
            }}
            className="border-ink-700 hover:border-accent hover:text-accent rounded-md border px-3 py-1.5 text-xs text-zinc-300 transition"
            title="為手動放進 images/ 的圖片補回標題、作者與來源 URL"
          >
            補全中繼資料
          </button>
        </footer>
      </aside>
    </div>
  )
}

function Progress({ job }: { job: Job }) {
  const handled = job.done + job.skipped + job.failed
  const pct = job.total ? Math.round((handled / job.total) * 100) : 0
  return (
    <div className="mt-1.5">
      <div className="bg-ink-800 h-1 overflow-hidden rounded-full">
        <div className="bg-accent h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 truncate text-[11px] text-zinc-500">
        {handled}/{job.total || '?'} · {job.current || '準備中…'}
      </p>
    </div>
  )
}

function StatusDot({ status }: { status: Job['status'] }) {
  const color =
    status === 'running'
      ? 'bg-amber-400 animate-pulse'
      : status === 'done'
        ? 'bg-emerald-400'
        : status === 'cancelled'
          ? 'bg-zinc-500'
          : 'bg-red-400'
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
}
