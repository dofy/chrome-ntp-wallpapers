import type { LocalImage } from '../lib/types'
import { bytes, resolution } from '../lib/format'

interface Props {
  image: LocalImage
  onOpen: () => void
}

export default function Card({ image, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group ring-ink-800 hover:ring-accent/60 focus-visible:ring-accent block w-full overflow-hidden rounded-xl text-left ring-1 transition focus:outline-none focus-visible:ring-2"
    >
      <div className="bg-ink-900 relative aspect-video overflow-hidden">
        <img
          src={image.thumb}
          alt={image.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="bg-ink-950/75 absolute right-2 bottom-2 rounded px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-300 backdrop-blur-sm">
          {resolution(image.width, image.height)}
        </span>
      </div>
      <div className="bg-ink-900/60 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-zinc-100">{image.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-500">
          <span className="truncate">{image.artist || '未署名'}</span>
          <span className="text-ink-700">·</span>
          <span className="shrink-0 tabular-nums">{bytes(image.bytes)}</span>
        </p>
      </div>
    </button>
  )
}
