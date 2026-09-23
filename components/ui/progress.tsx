import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

export type ProgressSize = 'sm' | 'md'

export interface ProgressProps {
  value: number | null
  max?: number
  label?: string
  size?: ProgressSize
  className?: string
}

const progressSizes: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
}

export function Progress({
  value,
  max = 100,
  label,
  size = 'md',
  className,
}: ProgressProps) {
  const isIndeterminate = value === null
  const percent = isIndeterminate
    ? 0
    : Math.max(0, Math.min(100, (value / max) * 100))
  const style: CSSProperties | undefined = isIndeterminate
    ? undefined
    : ({ '--progress': `${percent}%` } as CSSProperties)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={isIndeterminate ? undefined : value}
      aria-label={label}
      className={cn(
        'overflow-hidden rounded-full bg-[var(--cx-border-1)]',
        progressSizes[size],
        className,
      )}
    >
      <div
        style={style}
        className={cn(
          'h-full rounded-full bg-[var(--cx-brand)] transition-[width] duration-300',
          isIndeterminate && 'w-1/3 animate-pulse',
          !isIndeterminate && 'w-[var(--progress)]',
        )}
      />
    </div>
  )
}
