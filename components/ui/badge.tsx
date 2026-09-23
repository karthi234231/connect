import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

type BadgeVariant = 'default' | 'brand' | 'outline' | 'success' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children?: ReactNode
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]',
  brand: 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]',
  outline: 'border border-[var(--cx-border-1)] text-[var(--cx-text-2)]',
  success: 'bg-[var(--cx-success-soft)] text-[var(--cx-success)]',
  danger: 'bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]',
}

export function Badge({
  variant = 'default',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  )
}
