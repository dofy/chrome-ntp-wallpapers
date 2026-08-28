import { useEffect, useState } from 'react'
import type { LocalImage } from '../lib/types'
import { bytes, resolution } from '../lib/format'

interface Props {
  images: LocalImage[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}

export default function Lightbox({ images, index, onIndex, onClose }: Props) {
  const image = images[index]
  const [copied, setCopied] = useState(false)

  useEffect(() => setCopied(false), [index])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndex((index + 1) % images.length)
      if (event.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [index, images.length, onClose, onIndex])

  if (!image) return null

  async function copyPath() {
    // The sidecar serves /images/<collection>/<file> straight off disk, so the
    // URL path doubles as the on-disk relative path.
    await navigator.clipboard.writeText(`images/${image.id}`)
    setCopied(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      className="bg-ink-950/92 fixed inset-0 z-50 flex flex-col backdrop-blur-sm"
      onClick={onClose}
    >
      <header
        className="border-ink-800 flex shrink-0 items-center gap-4 border-b px-5 py-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-zinc-100">{image.title}</h2>
          <p className="truncate text-xs text-zinc-500">
            {image.artist || '未署名'} · {image.collection_name} ·{' '}
            {resolution(image.width, image.height)} · {bytes(image.bytes)}
          </p>
        </div>
        <span className="hidden shrink-0 text-xs tabular-nums text-zinc-600 sm:block">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={copyPath}
          className="border-ink-700 hover:border-accent hover:text-accent shrink-0 rounded-md border px-2.5 py-1.5 text-xs text-zinc-300 transition"
        >
          {copied ? '已複製路徑' : '複製路徑'}
        </button>
        <a
          href={image.file}
          download
          className="border-ink-700 hover:border-accent hover:text-accent shrink-0 rounded-md border px-2.5 py-1.5 text-xs text-zinc-300 transition"
        >
          下載原圖
        </a>
        {image.source_url && (
          <a
            href={`${image.source_url}=w5120-h2880-p-k-no-nd-mv`}
            target="_blank"
            rel="noreferrer"
            className="border-ink-700 hover:border-accent hover:text-accent hidden shrink-0 rounded-md border px-2.5 py-1.5 text-xs text-zinc-300 transition md:block"
          >
            5K 原始來源
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="hover:bg-ink-800 shrink-0 rounded-md px-2.5 py-1.5 text-lg leading-none text-zinc-400 transition hover:text-zinc-100"
        >
          ✕
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <figure
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-full min-h-0 flex-col items-center gap-3"
        >
          <img
            src={image.file}
            alt={image.title}
            className="min-h-0 max-w-full flex-1 rounded-lg object-contain shadow-2xl"
          />
          {image.note && (
            <figcaption className="max-w-3xl shrink-0 text-center text-xs leading-relaxed text-zinc-400">
              {image.note}
            </figcaption>
          )}
        </figure>
        {images.length > 1 && (
          <>
            <NavButton side="left" onClick={() => onIndex((index - 1 + images.length) % images.length)} />
            <NavButton side="right" onClick={() => onIndex((index + 1) % images.length)} />
          </>
        )}
      </div>

      <footer className="shrink-0 pb-3 text-center text-[11px] text-zinc-600">
        ← → 切換 · Esc 關閉
      </footer>
    </div>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? '上一張' : '下一張'}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`bg-ink-900/80 hover:bg-accent hover:text-ink-950 absolute top-1/2 -translate-y-1/2 rounded-full p-3 text-zinc-300 transition ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}
