import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/utils/cn'

type UnavailableStateProps = {
  title?: ReactNode
  description?: ReactNode
  className?: string
}

export function UnavailableState({
  title = 'Not available',
  description = "This content isn't available to you right now.",
  className,
}: UnavailableStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[260px] items-center justify-center px-4',
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-[20px] border border-dashed border-[var(--cx-border-2)] bg-[var(--cx-surface-2)]/60 px-6 py-10 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--cx-surface-3)] text-[var(--cx-text-4)]">
          <Lock className="size-5" />
        </div>
        <h2 className="font-display text-base font-semibold text-[var(--cx-text-2)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-5 text-[var(--cx-text-4)]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
