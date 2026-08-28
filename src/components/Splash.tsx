import { m } from '../paraglide/messages'

/**
 * First-paint splash. Covers the gap between the app shell mounting and the
 * library request returning, then fades out. Kept deliberately short-lived —
 * it exists so the page never flashes an empty grid.
 */
export default function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div
      aria-hidden={leaving}
      role="status"
      className={`bg-paper fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 transition-opacity duration-500 ease-out ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img src="/favicon.svg" alt="" className="breathe size-16 drop-shadow-md" />
      <p className="text-ink-faint text-xs tracking-widest">{m.splash_loading()}</p>
    </div>
  )
}
