import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type KbdProps = HTMLAttributes<HTMLElement>

export const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'rounded-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] px-1.5 py-0.5 font-medium text-[10px] shadow-[inset_0_-1px_0_var(--cx-border-2)]',
        className,
      )}
      {...props}
    />
  ),
)
Kbd.displayName = 'Kbd'
