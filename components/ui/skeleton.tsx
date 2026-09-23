import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'cx-shimmer rounded-lg bg-[var(--cx-surface-3)]/80',
        className,
      )}
      {...props}
    />
  )
}
