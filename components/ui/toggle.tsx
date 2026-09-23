'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  pressed: boolean
  onPressedChange?: (pressed: boolean) => void
  size?: 'sm' | 'md'
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      pressed,
      onPressedChange,
      size = 'md',
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border font-medium transition select-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
          : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
Toggle.displayName = 'Toggle'
