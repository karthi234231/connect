import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'
import { cn } from '@/utils/cn'

type NotFoundStateProps = {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function NotFoundState({
  title = 'Nothing found here',
  description = "We couldn't find the page or content you're looking for.",
  action,
  className,
}: NotFoundStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[300px] items-center justify-center px-4',
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 py-10 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]">
          <SearchX className="size-6" />
        </div>
        <h2 className="font-display text-lg font-semibold tracking-[-.02em]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm leading-5 text-[var(--cx-text-3)]">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}
