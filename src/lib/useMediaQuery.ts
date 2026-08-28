import { useEffect, useState } from 'react'

/**
 * Reactive media query.
 *
 * The compact header swaps whole control groups rather than restyling them, so
 * the breakpoint has to be a value the component can branch on. Expressing it
 * in CSS would mean two sets of utilities fighting each other with `!`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
