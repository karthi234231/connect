'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(
          'w-full appearance-none rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 pr-9 text-sm outline-none',
          'placeholder:text-[var(--cx-text-4)]',
          'focus:border-[var(--cx-brand)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          '[&>option]:bg-[var(--cx-surface-2)] [&>option]:text-[var(--cx-text-1)]',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cx-text-4)]" />
    </div>
  ),
)
Select.displayName = 'Select'
