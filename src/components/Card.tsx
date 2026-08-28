import type { LocalImage } from '../lib/types'
import { bytes, resolution } from '../lib/format'
import { useReveal } from '../lib/useReveal'

interface Props {
  image: LocalImage
  onOpen: () => void
}

export default function Card({ image, onOpen }: Props) {
  const { ref, shown } = useReveal<HTMLButtonElement>()

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className={`group glass rounded-blob hover:border-mint focus-visible:border-mint block w-full p-2 text-left hover:-translate-y-1.5 focus:outline-none ${
        shown ? 'reveal reveal-in' : 'reveal'
      }`}
    >
      {/* Inset, separately rounded thumbnail: the glass frame stays visible on
          every edge, which reads softer than a full-bleed image. */}
      <div className="rounded-soft relative aspect-video overflow-hidden">
        <img
          src={image.thumb}
          alt={image.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
        />
        <span className="glass-chip text-ink-soft absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[10px] tabular-nums opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {resolution(image.width, image.height)}
        </span>
      </div>
      <div className="px-2 pt-2.5 pb-1">
        <p className="truncate text-sm font-semibold">{image.title}</p>
        <p className="text-ink-faint mt-0.5 flex items-center gap-1.5 truncate text-xs">
          <span className="truncate">{image.artist || '未署名'}</span>
          <span className="text-line">◦</span>
          <span className="shrink-0 tabular-nums">{bytes(image.bytes)}</span>
        </p>
      </div>
    </button>
  )
}
