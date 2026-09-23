'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm outline-none',
        'placeholder:text-[var(--cx-text-4)]',
        'focus:border-[var(--cx-brand)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
