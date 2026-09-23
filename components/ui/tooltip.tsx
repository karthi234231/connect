'use client'

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/cn'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: TooltipSide
  className?: string
}

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: TooltipProps) {
  const id = useId()

  const trigger = isValidElement(children) ? (
    cloneElement(
      children as unknown as ReactElement<{ 'aria-describedby'?: string }>,
      { 'aria-describedby': id },
    )
  ) : (
    <span className="inline-flex">{children}</span>
  )

  return (
    <span className="group relative inline-flex">
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-xs rounded-lg border border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] px-2.5 py-1.5 text-xs text-[var(--cx-text-1)] opacity-0 shadow-[var(--cx-shadow-elevated)] transition',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          SIDE_CLASSES[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  )
}
