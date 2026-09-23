import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface SectionHeadingProps {
  title: ReactNode
  action?: string
  onAction?: () => void
  className?: string
}

export function SectionHeading({
  title,
  action,
  onAction,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <h2 className="font-display text-xl font-medium tracking-[-0.025em]">
        {title}
      </h2>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-medium text-[var(--cx-brand-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)]"
        >
          {action}
        </button>
      ) : null}
    </div>
  )
}
