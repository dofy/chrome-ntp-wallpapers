import { useEffect } from 'react'

export interface Hotkey {
  /** `event.key`, matched case-insensitively. */
  key: string
  run: () => void
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return EDITABLE.has(target.tagName) || target.isContentEditable
}

/**
 * Single keydown listener for a whole screen's shortcuts.
 *
 * Bindings are skipped while the user is typing, and whenever a modifier is
 * held — otherwise a bare `f` binding would eat Cmd-F, and `d` would eat
 * Ctrl-D. `allowWhileTyping` opts a key back in for the ones that have to work
 * inside a field, such as Escape.
 */
export function useHotkeys(hotkeys: Hotkey[], allowWhileTyping: string[] = ['Escape']) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const typing = isTyping(event.target)
      for (const { key, run } of hotkeys) {
        if (event.key.toLowerCase() !== key.toLowerCase()) continue
        if (typing && !allowWhileTyping.includes(key)) continue
        event.preventDefault()
        run()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
