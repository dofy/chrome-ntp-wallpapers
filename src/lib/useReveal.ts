import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll.
 *
 * One module-level IntersectionObserver serves every card — 200 separate
 * observers would be a lot of bookkeeping for the browser to redo on each
 * filter change. Elements unobserve themselves once seen, so a card animates
 * exactly once per mount.
 */
type Callback = () => void

const callbacks = new WeakMap<Element, Callback>()
let observer: IntersectionObserver | null = null

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        callbacks.get(entry.target)?.()
        callbacks.delete(entry.target)
        self.unobserve(entry.target)
      }
    },
    // Start a little before the card scrolls into view so the fade finishes
    // roughly as it lands, rather than beginning once it is already visible.
    { rootMargin: '120px 0px', threshold: 0.01 },
  )
  return observer
}

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion) return
    const node = ref.current
    if (!node) return
    // Anything already on screen at mount should not wait for a scroll event.
    if (node.getBoundingClientRect().top < window.innerHeight + 120) {
      setShown(true)
      return
    }
    callbacks.set(node, () => setShown(true))
    shared().observe(node)
    return () => {
      callbacks.delete(node)
      shared().unobserve(node)
    }
  }, [])

  return { ref, shown }
}
