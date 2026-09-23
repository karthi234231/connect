import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-20 items-center justify-center rounded-[28px] bg-[var(--cx-brand-soft)] text-[var(--cx-brand)]">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold tracking-[-0.02em]">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-5 text-[var(--cx-text-3)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
