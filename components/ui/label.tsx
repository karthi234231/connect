'use client'

import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  disabled?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, disabled, children, ...props }, ref) => (
    <label
      ref={ref}
      data-disabled={disabled || undefined}
      className={cn(
        'font-medium text-sm text-[var(--cx-text-2)]',
        'data-disabled:pointer-events-none data-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </label>
  ),
)
Label.displayName = 'Label'
