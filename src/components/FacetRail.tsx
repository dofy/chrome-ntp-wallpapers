import { m } from '../paraglide/messages'
import Facets from './Facets'
import { Broom, Brush, Folder } from './Icons'
import { bytes } from '../lib/format'

interface Facet {
  key: string
  label: string
  count: number
}

interface Props {
  imageCount: number
  totalBytes: number
  collectionFacets: Facet[]
  artistFacets: Facet[]
  collections: Set<string>
  artists: Set<string>
  filtersOn: boolean
  onToggleCollection: (key: string) => void
  onToggleArtist: (key: string) => void
  onClear: () => void
}

/**
 * Shared by the desktop rail and the small-screen filter sheet, so the two can
 * never drift apart. The header and the clear control stay put; only the facet
 * lists scroll.
 */
export default function FacetRail({
  imageCount,
  totalBytes,
  collectionFacets,
  artistFacets,
  collections,
  artists,
  filtersOn,
  onToggleCollection,
  onToggleArtist,
  onClear,
}: Props) {
  return (
    <>
      <div className="shrink-0 border-b border-white/60 pb-3">
        <p className="text-ink-faint text-xs">{m.library()}</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {m.library_stats({ count: imageCount, size: bytes(totalBytes) })}
        </p>
      </div>

      <div className={`collapse-y shrink-0 ${filtersOn ? 'collapse-y-open' : ''}`}>
        <div>
          <button
            type="button"
            tabIndex={filtersOn ? 0 : -1}
            onClick={onClear}
            className="chip tx hover:border-peach hover:text-peach-deep text-ink-soft mt-4 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
          >
            <Broom className="size-3.5" />
            {m.clear_filters()}
          </button>
        </div>
      </div>

      <div className="scroll-slim -mr-2 min-h-0 flex-1 overflow-y-auto pt-5 pr-2">
        <Facets
          title={m.facet_collections()}
          icon={<Folder className="size-3.5" />}
          facets={collectionFacets}
          selected={collections}
          onToggle={onToggleCollection}
        />
        <Facets
          title={m.facet_artists()}
          icon={<Brush className="size-3.5" />}
          facets={artistFacets}
          selected={artists}
          onToggle={onToggleArtist}
        />
      </div>
    </>
  )
}
