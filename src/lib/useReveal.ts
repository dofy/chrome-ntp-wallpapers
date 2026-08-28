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
    // Negative bottom margin, not positive. A positive margin fires while the
    // card is still below the fold, so the fade-up finishes before it scrolls
    // into view and the motion is never actually seen. Pulling the boundary up
    // means the card is already on screen when it starts to animate.
    { rootMargin: '0px 0px -12% 0px', threshold: 0 },
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
