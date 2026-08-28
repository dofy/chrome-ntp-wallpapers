import { useEffect, useState } from 'react'
import { Shuffle } from './Icons'
import type { LocalImage } from '../lib/types'

interface Props {
  image: LocalImage | null
  onShuffle: () => void
}

/**
 * Ambient page background: one random wallpaper, softly blurred so the glass
 * surfaces above it have something to refract. Uses the thumbnail rather than
 * the 4K original — it is blurred either way.
 *
 * Reshuffling keeps the outgoing image mounted underneath while the incoming
 * one fades in on top, so the page never flashes bare between the two.
 */
export default function Wallpaper({ image }: Props) {
  const [layers, setLayers] = useState<LocalImage[]>([])

  useEffect(() => {
    if (!image) return
    setLayers((previous) => {
      if (previous.at(-1)?.id === image.id) return previous
      // Two is enough: one fading in, one still showing beneath it.
      return [...previous.slice(-1), image]
    })
  }, [image])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {layers.map((layer) => (
        <img
          key={layer.id}
          src={layer.thumb}
          alt=""
          className="drift absolute inset-0 h-full w-full object-cover blur-2xl saturate-110"
        />
      ))}
      {/* Two layers: a flat scrim that guarantees a legibility floor whichever
          image was rolled, plus a soft vignette so the corners settle down and
          the eye stays on the grid. */}
      <div className="bg-paper/62 absolute inset-0" />
      <div className="from-paper/45 via-transparent to-paper/55 absolute inset-0 bg-gradient-to-b" />
    </div>
  )
}

export function WallpaperCredit({ image, onShuffle }: Props) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {/* Truncates rather than wrapping: on a phone a long title plus a long
          artist credit would otherwise push the footer to three lines. */}
      <span className="tx-slow min-w-0 truncate" key={image?.id ?? 'none'}>
        {image ? (
          <>
            背景
            <span className="text-ink-soft">
              {' '}
              《{image.title}》
              <span className="hidden sm:inline">
                {image.artist && ` · ${image.artist}`}
              </span>
            </span>
          </>
        ) : (
          <span className="text-ink-faint">背景載入中</span>
        )}
      </span>
      <button
        type="button"
        onClick={onShuffle}
        title="換一張背景"
        aria-label="換一張背景"
        className="tx hover:bg-mint hover:text-white ml-0.5 shrink-0 rounded-full p-1 hover:rotate-180"
      >
        <Shuffle className="size-3.5" />
      </button>
    </span>
  )
}
