export function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}

export function resolution(w: number | null, h: number | null): string {
  return w && h ? `${w}×${h}` : '—'
}

/** Case-insensitive substring match across every searchable field. */
export function matches(haystack: string[], needle: string): boolean {
  if (!needle) return true
  const terms = needle.toLowerCase().split(/\s+/).filter(Boolean)
  const blob = haystack.join(' ').toLowerCase()
  return terms.every((term) => blob.includes(term))
}
