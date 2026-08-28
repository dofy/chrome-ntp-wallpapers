import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll, bidirectional: a card fades up every time it enters the
 * viewport, and resets when it leaves, so scrolling back replays the motion.
 *
 * One module-level IntersectionObserver serves every card — 200 separate
 * observers would be a lot for the browser to redo on each filter change.
 */
type Callback = (visible: boolean) => void

const callbacks = new WeakMap<Element, Callback>()
let observer: IntersectionObserver | null = null

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        callbacks.get(entry.target)?.(entry.isIntersecting)
      }
    },
    // A generous margin means the fade finishes roughly as the card lands, and
    // the reset happens well off-screen where nobody sees it snap back.
    { rootMargin: '140px 0px', threshold: 0 },
  )
  return observer
}

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion()) return
    const node = ref.current
    if (!node) return
    callbacks.set(node, setShown)
    shared().observe(node)
    return () => {
      callbacks.delete(node)
      shared().unobserve(node)
    }
  }, [])

  return { ref, shown }
}
