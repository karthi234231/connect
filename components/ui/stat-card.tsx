import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/cn'

type StatTone = 'default' | 'brand' | 'success' | 'info' | 'danger'

export interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  trend?: 'up' | 'down' | null
  trendLabel?: string
  className?: string
}

const iconTones: Record<StatTone, string> = {
  default: 'bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]',
  brand: 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]',
  success: 'bg-[var(--cx-success-soft)] text-[var(--cx-success)]',
  info: 'bg-[var(--cx-info-soft)] text-[var(--cx-info)]',
  danger: 'bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]',
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  trend = null,
  trendLabel,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--cx-text-3)]">{label}</span>
        {icon ? (
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-xl',
              iconTones[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold">{value}</span>
        {trend ? (
          <span className="inline-flex items-center gap-1">
            {trend === 'up' ? (
              <TrendingUp
                className="size-3.5 text-[var(--cx-success)]"
                aria-hidden="true"
              />
            ) : (
              <TrendingDown
                className="size-3.5 text-[var(--cx-danger)]"
                aria-hidden="true"
              />
            )}
            {trendLabel ? (
              <span className="text-[11px] text-[var(--cx-text-3)]">
                {trendLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] text-[var(--cx-text-4)]">{hint}</p>
      ) : null}
    </div>
  )
}
