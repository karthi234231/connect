import { cn } from '@/utils/cn'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorProps {
  orientation?: SeparatorOrientation
  decorative?: boolean
  className?: string
}

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  className,
}: SeparatorProps) {
  return (
    <div
      role={decorative ? undefined : 'separator'}
      aria-orientation={
        decorative || orientation === 'horizontal' ? undefined : 'vertical'
      }
      className={cn(
        'bg-[var(--cx-border-1)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
        className,
      )}
    />
  )
}
