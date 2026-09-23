'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'rounded-full border border-[var(--cx-border-1)] px-2.5 py-1 text-[11px] transition select-none',
        active
          ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] font-medium text-[var(--cx-brand-strong)]'
          : 'text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
        className,
      )}
      {...props}
    />
  ),
)
Chip.displayName = 'Chip'
