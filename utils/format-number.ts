const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompact(n: number): string {
  return compactFormatter.format(n)
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0'

  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `${trim(n / 1_000)}k`

  return String(Math.round(n))
}

function trim(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}
