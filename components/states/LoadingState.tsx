import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/utils/cn'

type LoadingStateProps = {
  label?: string
  variant?: 'spinner' | 'skeleton'
  className?: string
}

export function LoadingState({
  label = 'Loading…',
  variant = 'spinner',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-[240px] flex-col items-center justify-center gap-4 px-4 text-center',
        className,
      )}
    >
      {variant === 'skeleton' ? (
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <Loader2 className="size-6 animate-spin text-[var(--cx-brand)]" />
      )}
      {label ? (
        <p className="text-xs text-[var(--cx-text-3)]">{label}</p>
      ) : null}
    </div>
  )
}
