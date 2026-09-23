import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

type FocusRingProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
}

export function FocusRing({ children, className, ...props }: FocusRingProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-lg outline-none',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--cx-brand-strong)]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
