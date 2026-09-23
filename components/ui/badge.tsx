import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

type BadgeVariant =
  | 'default'
  | 'brand'
  | 'outline'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  pulse?: boolean
  children?: ReactNode
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--cx-surface-3)] text-[var(--cx-text-2)] border border-transparent',
  brand:
    'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] border border-[color-mix(in_srgb,var(--cx-brand)_30%,transparent)]',
  outline:
    'border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/60 text-[var(--cx-text-2)] backdrop-blur-sm hover:border-[var(--cx-border-2)]',
  success:
    'bg-[var(--cx-success-soft)] text-[var(--cx-success)] border border-[color-mix(in_srgb,var(--cx-success)_30%,transparent)]',
  danger:
    'bg-[var(--cx-danger-soft)] text-[var(--cx-danger)] border border-[color-mix(in_srgb,var(--cx-danger)_30%,transparent)]',
  warning:
    'bg-[var(--cx-warning-soft)] text-[var(--cx-warning)] border border-[color-mix(in_srgb,var(--cx-warning)_30%,transparent)]',
  info:
    'bg-[var(--cx-info-soft)] text-[var(--cx-info)] border border-[color-mix(in_srgb,var(--cx-info)_30%,transparent)]',
}

export function Badge({
  variant = 'default',
  pulse = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 select-none',
        badgeVariants[variant],
        pulse && 'cx-pulse-glow',
        className,
      )}
      {...props}
    >
      {pulse && (
        <span
          className="size-1.5 rounded-full bg-current animate-ping opacity-75"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
