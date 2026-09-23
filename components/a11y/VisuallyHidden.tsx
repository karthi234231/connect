import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode
}

export function VisuallyHidden({
  children,
  className,
  ...props
}: VisuallyHiddenProps) {
  return (
    <span
      className={cn(
        'absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
