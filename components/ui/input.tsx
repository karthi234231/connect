'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/90 backdrop-blur-sm px-3.5 py-2.5 text-sm text-[var(--cx-text-1)] transition-all duration-200',
        'placeholder:text-[var(--cx-text-4)]',
        'hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-2)]',
        'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:border-transparent focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--cx-bg)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        error && 'border-[var(--cx-danger)] focus-visible:ring-[var(--cx-danger)]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
