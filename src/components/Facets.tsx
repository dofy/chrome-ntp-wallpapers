import type { ReactNode } from 'react'

interface Facet {
  key: string
  label: string
  count: number
}

interface Props {
  title: string
  icon: ReactNode
  facets: Facet[]
  selected: Set<string>
  onToggle: (key: string) => void
}

export default function Facets({ title, icon, facets, selected, onToggle }: Props) {
  if (facets.length === 0) return null
  return (
    <section className="mb-6">
      <h3 className="text-ink-faint mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold tracking-wider uppercase">
        {icon}
        {title}
      </h3>
      <ul className="space-y-0.5">
        {facets.map((facet) => {
          const on = selected.has(facet.key)
          return (
            <li key={facet.key}>
              <button
                type="button"
                onClick={() => onToggle(facet.key)}
                aria-pressed={on}
                className={`tx flex w-full items-center justify-between gap-2 rounded-full px-3 py-1.5 text-left text-sm
                  ${
                    on
                      ? 'bg-mint translate-x-1 text-white shadow-sm'
                      : 'text-ink-soft hover:bg-mint-wash hover:text-mint-deep hover:translate-x-1'
                  }`}
              >
                <span className="truncate">{facet.label}</span>
                <span
                  className={`tx shrink-0 rounded-full px-1.5 text-[11px] tabular-nums ${
                    on ? 'bg-white/25' : 'bg-paper-warm text-ink-faint'
                  }`}
                >
                  {facet.count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
