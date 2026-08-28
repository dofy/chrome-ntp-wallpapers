import { Shuffle } from './Icons'
import type { LocalImage } from '../lib/types'

interface Props {
  image: LocalImage | null
  onShuffle: () => void
}

/**
 * Ambient page background: one random wallpaper, softly blurred so the glass
 * surfaces above it have something to refract. Uses the thumbnail rather than
 * the 4K original — it is blurred either way, so there is no reason to pull
 * megabytes for it.
 *
 * The scrim is deliberately light. Text legibility is the job of the glass
 * panels on top, not of hiding the image.
 */
export default function Wallpaper({ image }: Props) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {image && (
        <img
          key={image.id}
          src={image.thumb}
          alt=""
          className="drift h-full w-full object-cover blur-2xl saturate-110"
        />
      )}
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
    <span className="flex items-center gap-1.5">
      {image ? (
        <>
          背景
          <span className="text-ink-soft">
            《{image.title}》{image.artist && ` · ${image.artist}`}
          </span>
        </>
      ) : (
        <span className="text-ink-faint">背景載入中</span>
      )}
      <button
        type="button"
        onClick={onShuffle}
        title="換一張背景"
        aria-label="換一張背景"
        className="hover:bg-mint hover:text-white ml-0.5 rounded-full p-1 transition"
      >
        <Shuffle className="size-3.5" />
      </button>
    </span>
  )
}
