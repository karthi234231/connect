'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  loading?: boolean
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      loading,
      isLoading,
      className,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isBusy = loading || isLoading
    const isDisabled = disabled || isBusy

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isBusy}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 select-none ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cx-bg)]',
          'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100',
          variant === 'primary' &&
            'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)] hover:shadow-[0_4px_16px_rgba(208,164,91,0.25)]',
          variant === 'secondary' &&
            'border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/90 backdrop-blur-sm text-[var(--cx-text-1)] hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-3)] hover:shadow-sm',
          variant === 'ghost' &&
            'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
          variant === 'danger' &&
            'bg-[var(--cx-danger)] text-white hover:opacity-90 hover:shadow-[0_4px_16px_rgba(228,125,114,0.25)]',
          size === 'sm' && 'h-8 px-3 text-xs gap-1.5',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-6 text-sm gap-2.5',
          size === 'icon' && 'size-10 p-0 rounded-full',
          className,
        )}
        {...props}
      >
        {isBusy ? (
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          icon
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
