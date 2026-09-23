const MS_MINUTE = 60_000
const MS_HOUR = 60 * MS_MINUTE
const MS_DAY = 24 * MS_HOUR

const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
})

export function formatMonthDay(iso: string): string {
  return monthDayFormatter.format(new Date(iso))
}

export function formatEventDate(iso: string): string {
  return dateFormatter.format(new Date(iso)).replace(',', ' ·')
}

export function formatRelativeDate(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso).getTime()
  const diff = now.getTime() - then

  if (diff < MS_MINUTE) return 'just now'
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)}m ago`
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}h ago`
  if (diff < 7 * MS_DAY) return `${Math.floor(diff / MS_DAY)}d ago`

  return formatMonthDay(iso)
}
