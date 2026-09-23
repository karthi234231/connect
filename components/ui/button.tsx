'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)]',
        variant === 'secondary' &&
          'border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-1)] hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-3)]',
        variant === 'ghost' &&
          'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
        variant === 'danger' &&
          'bg-[var(--cx-danger)] text-white hover:opacity-90',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-sm',
        size === 'icon' && 'size-10 p-0',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
