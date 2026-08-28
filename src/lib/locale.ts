import { useCallback, useEffect, useState } from 'react'
import { getLocale, locales, setLocale, type Locale } from '../paraglide/runtime'
import { m } from '../paraglide/messages'

/** Endonyms: a language picker should read in the language it offers. */
export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
}

export const LOCALES = locales as readonly Locale[]

/**
 * Message functions read the locale at call time, so switching only needs a
 * re-render — not the full document reload `setLocale` does by default. Holding
 * the locale in state gives React that re-render, and keeps the picker honest
 * about what is currently active.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale())

  // Reflect the resolved locale onto the document. Runs on mount too, not only
  // on change: index.html cannot know which locale the strategy will pick, so
  // without this the lang attribute and the tab title would stay at whatever
  // the HTML shipped with.
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `NTP Gallery — ${m.app_subtitle()}`
  }, [locale])

  const change = useCallback((next: Locale) => {
    if (next === locale) return
    setLocale(next, { reload: false })
    setLocaleState(next)
  }, [locale])

  return { locale, setLocale: change }
}
