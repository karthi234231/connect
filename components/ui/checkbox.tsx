'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface CheckboxProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'aria-checked'
> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked,
      onCheckedChange,
      size = 'md',
      disabled,
      ariaLabel = 'Toggle',
      className,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border transition',
        'hover:ring-4 hover:ring-[var(--cx-brand)]/15',
        'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)]'
          : 'border-[var(--cx-border-2)] bg-[var(--cx-surface-2)] hover:border-[var(--cx-brand)]',
        size === 'sm' && 'size-4',
        size === 'md' && 'size-5',
        className,
      )}
      {...props}
    >
      {checked && (
        <Check
          className={cn('text-white', size === 'sm' ? 'size-3' : 'size-3.5')}
          strokeWidth={3}
        />
      )}
    </button>
  ),
)
Checkbox.displayName = 'Checkbox'
