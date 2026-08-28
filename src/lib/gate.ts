/**
 * The fetch panel is hidden unless the address bar carries `?begin=again`.
 *
 * This gates the UI only. `POST /api/fetch` stays reachable — anyone who can
 * load the page can also curl the sidecar. Treat this as "keep the button out
 * of the way", not as an access control.
 */
const PARAM = 'begin'
const VALUE = 'again'

export function isFetchUnlocked(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get(PARAM) === VALUE
}

export const UNLOCK_HINT = `?${PARAM}=${VALUE}`
