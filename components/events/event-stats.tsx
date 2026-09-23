import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface EventStatsProps {
  rows: Array<{ label: string; value: string; icon: LucideIcon }>
  className?: string
}

interface EventStatProps {
  label: string
  value: string
  icon: LucideIcon
}

function EventStat({ label, value, icon: Icon }: EventStatProps) {
  return (
    <div className="rounded-xl bg-[var(--cx-surface-2)] p-3">
      <Icon className="mb-1 size-4 text-[var(--cx-brand)]" />
      <p className="truncate font-display text-2xl font-semibold tracking-[-.03em] text-[var(--cx-text-1)]">
        {value}
      </p>
      <p className="text-[10px] text-[var(--cx-text-3)]">{label}</p>
    </div>
  )
}

export function EventStats({ rows, className }: EventStatsProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {rows.map(({ label, value, icon }) => (
        <EventStat key={label} label={label} value={value} icon={icon} />
      ))}
    </div>
  )
}
