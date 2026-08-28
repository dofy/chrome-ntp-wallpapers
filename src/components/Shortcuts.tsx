import { usePresence } from '../lib/usePresence'
import { Close } from './Icons'
import { m } from '../paraglide/messages'

interface Props {
  open: boolean
  fetchUnlocked: boolean
  onClose: () => void
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-ink-soft min-w-0 truncate text-sm">{label}</span>
      <span className="flex shrink-0 gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="chip text-ink min-w-6 rounded-md px-1.5 py-0.5 text-center font-mono text-[11px]"
          >
            {key}
          </kbd>
        ))}
      </span>
    </li>
  )
}

export default function Shortcuts({ open, fetchUnlocked, onClose }: Props) {
  const { mounted, visible } = usePresence(open, 300)

  // Must leave the tree when closed. A fixed inset-0 overlay left mounted at
  // opacity 0 still takes every click on the page.
  if (!mounted) return null

  return (
    <div
      className={`overlay fixed inset-0 z-[55] flex items-center justify-center p-4 ${
        visible ? 'bg-ink/25 opacity-100 backdrop-blur-sm' : 'bg-ink/0 pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={m.shortcuts()}
        onClick={(event) => event.stopPropagation()}
        className={`glass-solid pop rounded-blob scroll-slim max-h-full w-full max-w-md overflow-y-auto p-5 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">{m.shortcuts()}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.close()}
            className="tx hover:bg-peach/20 hover:text-peach-deep text-ink-soft rounded-full p-2 hover:rotate-90"
          >
            <Close className="size-4" />
          </button>
        </div>

        <h3 className="text-ink-faint mb-1 text-[11px] font-bold tracking-wider uppercase">
          {m.sc_group_global()}
        </h3>
        <ul className="mb-4 divide-y divide-white/50">
          <Row keys={['/']} label={m.sc_search()} />
          <Row keys={['f']} label={m.sc_filter()} />
          {fetchUnlocked && <Row keys={['g']} label={m.sc_fetch()} />}
          <Row keys={['b']} label={m.sc_shuffle()} />
          <Row keys={['r']} label={m.sc_random()} />
          <Row keys={['s']} label={m.sc_sort()} />
          <Row keys={['x']} label={m.sc_clear()} />
          <Row keys={['?']} label={m.sc_help()} />
          <Row keys={['Esc']} label={m.sc_esc()} />
        </ul>

        <h3 className="text-ink-faint mb-1 text-[11px] font-bold tracking-wider uppercase">
          {m.sc_group_lightbox()}
        </h3>
        <ul className="divide-y divide-white/50">
          <Row keys={['←', '→']} label={m.sc_nav()} />
          <Row keys={['Home', 'End']} label={m.sc_first_last()} />
          <Row keys={['c']} label={m.sc_copy()} />
          <Row keys={['d']} label={m.sc_download()} />
        </ul>
      </div>
    </div>
  )
}
