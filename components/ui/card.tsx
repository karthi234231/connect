import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  glass?: boolean
  hover?: boolean
}

export function Card({ className, glass = false, hover = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[var(--cx-border-1)] text-[var(--cx-text-1)] transition-all duration-200 ease-out',
        glass
          ? 'bg-[var(--cx-glass-bg)] border-[var(--cx-glass-border)] backdrop-blur-[var(--cx-glass-blur)] shadow-[var(--cx-glass-shadow)]'
          : 'bg-[var(--cx-surface-1)] shadow-[var(--cx-shadow-card)]',
        hover &&
          'hover:-translate-y-0.5 hover:border-[var(--cx-border-2)] hover:shadow-[var(--cx-shadow-elevated)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
  )
}

export function CardTitle({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'font-display text-lg font-medium tracking-[-0.02em] text-[var(--cx-text-1)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('text-sm leading-5 text-[var(--cx-text-3)]', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex items-center gap-2 p-5 pt-0', className)}
      {...props}
    />
  )
}
