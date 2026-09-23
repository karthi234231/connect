import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

type ErrorStateProps = {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We hit a snag loading this. Please try again in a moment.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-[240px] items-center justify-center px-4',
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 py-10 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]">
          <TriangleAlert className="size-6" />
        </div>
        <h2 className="font-display text-lg font-semibold tracking-[-.02em]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-5 text-[var(--cx-text-3)]">
            {description}
          </p>
        ) : null}
        {onRetry ? (
          <div className="mt-5">
            <Button type="button" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
