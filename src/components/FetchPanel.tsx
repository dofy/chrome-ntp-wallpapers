import { useEffect, useState } from 'react'
import { usePresence } from '../lib/usePresence'
import { api } from '../lib/api'
import type { Job, RemoteCollection } from '../lib/types'
import { Broom, ChevronDown, Close, Shuffle, Sparkle } from './Icons'

const SIZES = [
  { key: '1080p', label: '1920×1080' },
  { key: '4k', label: '3840×2160' },
  { key: '5k', label: '5120×2880' },
]

interface Props {
  open: boolean
  onClose: () => void
  onLibraryChanged: () => void
}

export default function FetchPanel({ open, onClose, onLibraryChanged }: Props) {
  const { visible } = usePresence(open, 380)
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
    <div
      className={`overlay fixed inset-0 z-40 flex justify-end ${
        visible ? 'bg-ink/25 opacity-100 backdrop-blur-sm' : 'bg-ink/0 opacity-0'
      }`}
      onClick={onClose}
    >
      <aside
        className={`glass-solid drawer flex h-full w-full max-w-xl flex-col rounded-none border-y-0 border-r-0 ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-line flex items-center gap-3 border-b px-5 py-4">
          <span className="bg-mint-wash text-mint-deep rounded-full p-2">
            <Sparkle className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold">抓圖</h2>
            <p className="text-ink-faint text-xs">已存在的檔案自動跳過</p>
          </div>
          <span className="relative shrink-0">
            <select
              value={size}
              onChange={(event) => setSize(event.target.value)}
              className="tx border-line hover:border-mint text-ink-soft cursor-pointer appearance-none rounded-full border bg-white/80 py-1.5 pr-8 pl-3 text-xs"
            >
              {SIZES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="text-ink-faint pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="tx hover:bg-peach/20 hover:text-peach-deep text-ink-soft rounded-full p-2 hover:rotate-90"
          >
            <Close className="size-5" />
          </button>
        </header>

        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          {loading && collections.length === 0 ? (
            <p className="text-ink-faint text-sm">載入集合列表…</p>
          ) : (
            <ul className="space-y-2">
              {collections.map((collection) => {
                const active = running.find((j) => j.collection_id === collection.id)
                return (
                  <li
                    key={collection.id}
                    className="tx border-line rounded-blob hover:border-mint flex items-center gap-3 border bg-white/55 p-3 hover:bg-white/80"
                  >
                    {collection.preview_url && (
                      <img
                        src={`${collection.preview_url}=w160-h90-p-k-no-nd-mv`}
                        alt=""
                        loading="lazy"
                        className="tx bg-paper-warm h-12 w-20 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{collection.name}</p>
                      <p className="text-ink-faint truncate font-mono text-[11px]">{collection.id}</p>
                      {active ? (
                        <Progress job={active} />
                      ) : (
                        <p className="text-ink-faint mt-1 text-xs">
                          本地已有 <span className="text-ink tabular-nums">{collection.downloaded}</span> 張
                        </p>
                      )}
                    </div>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => void api.cancelJob(active.id)}
                        className="tx shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        取消
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void start(collection.id)}
                        className="tx border-mint text-mint-deep hover:bg-mint shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold hover:scale-105 hover:text-white"
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
              <h3 className="text-ink-faint mb-2 text-[11px] font-bold tracking-wider uppercase">
                任務紀錄
              </h3>
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.id} className="border-line rounded-blob border bg-white/55 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusDot status={job.status} />
                      <span className="flex-1 truncate font-medium">{job.collection_name}</span>
                      <span className="text-ink-faint tabular-nums">
                        {job.done} 新增 · {job.skipped} 跳過
                        {job.failed > 0 && ` · ${job.failed} 失敗`}
                      </span>
                    </div>
                    {job.error && <p className="mt-1 text-xs text-red-500">{job.error}</p>}
                    {job.log.length > 0 && (
                      <pre className="scroll-slim text-ink-faint bg-paper-warm/60 mt-2 max-h-28 overflow-y-auto rounded-xl p-2 font-mono text-[10px] leading-relaxed">
                        {job.log.slice(-40).join('\n')}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="border-line flex items-center gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={() => void loadCollections(true)}
            className="tx border-line hover:border-mint hover:text-mint-deep text-ink-soft flex items-center gap-1.5 rounded-full border bg-white/60 px-3 py-1.5 text-xs hover:bg-white/90"
          >
            <Shuffle className="size-3.5" />
            重新載入集合
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.reindex()
              onLibraryChanged()
            }}
            className="tx border-line hover:border-mint hover:text-mint-deep text-ink-soft flex items-center gap-1.5 rounded-full border bg-white/60 px-3 py-1.5 text-xs hover:bg-white/90"
            title="為手動放進 images/ 的圖片補回標題、作者與來源 URL"
          >
            <Broom className="size-3.5" />
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
      <div className="bg-paper-warm h-1.5 overflow-hidden rounded-full">
        <div className="bg-mint h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-ink-faint mt-1 truncate text-[11px]">
        {handled}/{job.total || '?'} · {job.current || '準備中…'}
      </p>
    </div>
  )
}

function StatusDot({ status }: { status: Job['status'] }) {
  const color =
    status === 'running'
      ? 'bg-peach animate-pulse'
      : status === 'done'
        ? 'bg-mint'
        : status === 'cancelled'
          ? 'bg-ink-faint'
          : 'bg-red-400'
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
}
