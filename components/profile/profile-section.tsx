import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface ProfileSectionProps {
  title: string
  action?: string
  onAction?: () => void
  children?: ReactNode
  className?: string
}

export function ProfileSection({
  title,
  action,
  onAction,
  children,
  className,
}: ProfileSectionProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-medium tracking-[-.02em] text-[var(--cx-text-1)]">
          {title}
        </h3>
        {action ? (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-medium text-[var(--cx-brand-strong)] hover:underline"
          >
            {action}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )
}
