import { useCallback, useEffect, useState } from 'react'
import { m } from '../paraglide/messages'
import { usePresence } from '../lib/usePresence'
import { useHotkeys } from '../lib/useHotkeys'
import type { LocalImage } from '../lib/types'
import { bytes, resolution } from '../lib/format'
import { Check, ChevronLeft, ChevronRight, Close, Copy, Download, External } from './Icons'

interface Props {
  open: boolean
  images: LocalImage[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}

export default function Lightbox({ open, images, index, onIndex, onClose }: Props) {
  const image = images[index]
  const [copied, setCopied] = useState(false)
  const { visible } = usePresence(open, 300)

  useEffect(() => setCopied(false), [index])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const copyPath = useCallback(async () => {
    if (!image) return
    // The sidecar serves /images/<collection>/<file> straight off disk, so the
    // URL path doubles as the on-disk relative path.
    await navigator.clipboard.writeText(`images/${image.id}`)
    setCopied(true)
  }, [image])

  // Escape is owned by App, which closes the innermost surface — handling it
  // here too would fight that.
  useHotkeys([
    { key: 'ArrowRight', run: () => onIndex((index + 1) % images.length) },
    { key: 'ArrowLeft', run: () => onIndex((index - 1 + images.length) % images.length) },
    { key: 'Home', run: () => onIndex(0) },
    { key: 'End', run: () => onIndex(images.length - 1) },
    { key: 'c', run: () => void copyPath() },
    {
      key: 'd',
      run: () => {
        if (!image) return
        // Same path a click on the download pill takes.
        const link = document.createElement('a')
        link.href = image.file
        link.download = ''
        link.click()
      },
    },
  ])

  if (!image) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      className={`glass-solid overlay fixed inset-0 z-50 flex flex-col rounded-none border-0 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <header
        className="border-white/50 flex shrink-0 items-center gap-2 border-b px-5 py-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">{image.title}</h2>
          <p className="text-ink-faint truncate text-xs">
            {image.artist || m.unattributed()} · {image.collection_name} ·{' '}
            {resolution(image.width, image.height)} · {bytes(image.bytes)}
          </p>
        </div>
        <span className="text-ink-faint hidden shrink-0 px-1 text-xs tabular-nums sm:block">
          {index + 1} / {images.length}
        </span>
        <Pill onClick={copyPath} label={copied ? m.copied() : m.copy_path()}>
          {copied ? <Check /> : <Copy />}
        </Pill>
        <Pill href={image.file} download label={m.download_original()}>
          <Download />
        </Pill>
        {image.source_url && (
          <Pill
            href={`${image.source_url}=w5120-h2880-p-k-no-nd-mv`}
            external
            label={m.source_5k()}
            hideOnSmall
          >
            <External />
          </Pill>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={m.close()}
          className="tx hover:bg-peach/20 hover:text-peach-deep text-ink-soft shrink-0 rounded-full p-2 hover:rotate-90"
        >
          <Close className="size-5" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <figure
          onClick={(event) => event.stopPropagation()}
          className={`pop flex max-h-full min-h-0 flex-col items-center gap-3 ${
            visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          {/* Keyed on the image so stepping through with the arrows crossfades
              rather than swapping the bitmap under the frame. */}
          <img
            key={image.id}
            src={image.file}
            alt={image.title}
            className="rounded-blob rise min-h-0 max-w-full flex-1 object-contain shadow-xl"
          />
          {image.note && (
            <figcaption className="text-ink-soft max-w-3xl shrink-0 text-center text-xs leading-relaxed">
              {image.note}
            </figcaption>
          )}
        </figure>
        {images.length > 1 && (
          <>
            <Nav side="left" onClick={() => onIndex((index - 1 + images.length) % images.length)} />
            <Nav side="right" onClick={() => onIndex((index + 1) % images.length)} />
          </>
        )}
      </div>

      <footer className="text-ink-faint shrink-0 pb-3 text-center text-[11px]">
        {m.lightbox_keys()}
      </footer>
    </div>
  )
}

interface PillProps {
  children: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  download?: boolean
  external?: boolean
  hideOnSmall?: boolean
}

function Pill({ children, label, onClick, href, download, external, hideOnSmall }: PillProps) {
  const className = `chip tx hover:border-mint hover:text-mint-deep text-ink-soft flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs hover:scale-105 ${
    hideOnSmall ? 'hidden md:flex' : ''
  }`
  if (href) {
    return (
      <a
        href={href}
        download={download}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        className={className}
      >
        {children}
        {label}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
      {label}
    </button>
  )
}

function Nav({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? m.prev_image() : m.next_image()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`chip tx hover:bg-mint text-ink-soft absolute top-1/2 -translate-y-1/2 rounded-full p-3 shadow-md hover:scale-110 hover:text-white ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      {side === 'left' ? <ChevronLeft /> : <ChevronRight />}
    </button>
  )
}
