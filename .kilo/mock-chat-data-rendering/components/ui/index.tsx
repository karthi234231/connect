import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Avatar({
  className,
  avatarClassName,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { avatarClassName?: string }): ReactNode {
  return (
    <span
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full',
        avatarClassName,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function AvatarFallback({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>): ReactNode {
  return (
    <span
      className={cn(
        'flex size-full items-center justify-center font-semibold uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

type BadgeVariant = 'default' | 'outline' | 'brand'

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]',
  outline: 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-3)]',
  brand: 'border-transparent bg-[var(--cx-brand)] text-white',
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none',
        BADGE_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div
      className={cn(
        'rounded-3xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode
  title: string
  description?: string
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--cx-surface-2)] text-[var(--cx-text-3)]">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-[var(--cx-text-1)]">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-[var(--cx-text-3)]">{description}</p>
      ) : null}
    </div>
  )
}
