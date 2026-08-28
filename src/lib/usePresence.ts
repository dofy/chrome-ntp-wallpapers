import { useEffect, useState } from 'react'

/**
 * Keeps a component mounted through its exit animation.
 *
 * Conditional rendering alone makes overlays pop in and vanish. `mounted` stays
 * true for `duration` after `open` flips to false, and `visible` is flipped on
 * the frame after mount so the enter transition has a starting state to move
 * from.
 */
export function usePresence(open: boolean, duration = 320) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Two frames, not one. A single rAF can still run before the browser has
      // painted the closed state, which puts both states in the same frame and
      // makes the enter transition get skipped entirely.
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), duration)
    return () => window.clearTimeout(timer)
  }, [open, duration])

  return { mounted, visible }
}
