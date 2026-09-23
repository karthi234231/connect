import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type PageHeaderProps = {
  eyebrow?: string
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-end justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--cx-text-3)]">
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <h1 className="font-display text-[23px] font-semibold tracking-[-.045em] sm:text-[32px]">
            {title}
          </h1>
        ) : null}
        {description ? (
          <p className="mt-1 text-sm text-[var(--cx-text-3)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
