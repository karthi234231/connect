import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

const DOT_ANIMATIONS = [
  'animate-[bounce_1s_infinite_0s]',
  'animate-[bounce_1s_infinite_.15s]',
  'animate-[bounce_1s_infinite_.3s]',
]

export interface TypingIndicatorProps {
  tone?: string
  label?: string
  className?: string
}

export function TypingIndicator({
  tone,
  label = 'Typing',
  className,
}: TypingIndicatorProps): ReactNode {
  return (
    <div className={cn('flex w-fit items-end gap-2', className)}>
      {tone ? (
        <div
          aria-hidden="true"
          className={cn('size-7 shrink-0 rounded-full', tone)}
        />
      ) : null}
      <div
        role="status"
        className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-4 py-3"
      >
        {DOT_ANIMATIONS.map((animation, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full bg-[var(--cx-text-3)] animate-bounce',
              animation,
            )}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}
