import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize | number
  label?: string
  className?: string
}

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: 'size-3.5',
  md: 'size-5',
  lg: 'size-8',
}

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
}: SpinnerProps) {
  const style: CSSProperties | undefined =
    typeof size === 'number' ? { width: size, height: size } : undefined
  const sizeClass = typeof size === 'number' ? undefined : spinnerSizes[size]

  return (
    <span role="status" className={cn('inline-flex items-center', className)}>
      <span
        aria-hidden="true"
        style={style}
        className={cn(
          'animate-spin rounded-full border-[3px] border-[var(--cx-border-2)] border-t-[var(--cx-brand)]',
          sizeClass,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
