import { ChevronDown, Globe } from './Icons'
import { LOCALE_NAMES, LOCALES } from '../lib/locale'
import { m } from '../paraglide/messages'
import type { Locale } from '../paraglide/runtime'

interface Props {
  locale: Locale
  onChange: (next: Locale) => void
}

export default function LocalePicker({ locale, onChange }: Props) {
  return (
    <label className="flex shrink-0 items-center gap-1" title={m.language()}>
      <Globe className="size-3.5" />
      <span className="relative">
        <select
          value={locale}
          onChange={(event) => onChange(event.target.value as Locale)}
          aria-label={m.language()}
          className="tx text-ink-soft hover:text-mint-deep cursor-pointer appearance-none border-0 bg-transparent py-0.5 pr-4 pl-0.5 text-[11px] focus:outline-none"
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code] ?? code}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-3 -translate-y-1/2" />
      </span>
    </label>
  )
}
