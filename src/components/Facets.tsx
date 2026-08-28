interface Facet {
  key: string
  label: string
  count: number
}

interface Props {
  title: string
  facets: Facet[]
  selected: Set<string>
  onToggle: (key: string) => void
}

export default function Facets({ title, facets, selected, onToggle }: Props) {
  if (facets.length === 0) return null
  return (
    <section className="mb-6">
      <h3 className="mb-2 px-1 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
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
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition
                  ${on ? 'bg-accent-soft text-accent' : 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-200'}`}
              >
                <span className="truncate">{facet.label}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] tabular-nums
                    ${on ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-zinc-500'}`}
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
