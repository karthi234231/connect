import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]',
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
        'font-display text-lg font-medium tracking-[-0.02em]',
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
