import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  variant?: AlertVariant
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  role?: 'status' | 'alert' | 'none'
  className?: string
  children?: ReactNode
}

type AlertDivProps = HTMLAttributes<HTMLDivElement>

const alertVariants: Record<AlertVariant, string> = {
  info: 'border-[var(--cx-info)]/20 bg-[var(--cx-info-soft)] text-[var(--cx-info)]',
  success:
    'border-[var(--cx-success)]/20 bg-[var(--cx-success-soft)] text-[var(--cx-success)]',
  warning:
    'border-[var(--cx-ember)]/20 bg-[color:var(--cx-ember)/0.12] text-[var(--cx-ember)]',
  danger:
    'border-[var(--cx-danger)]/20 bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]',
}

export function Alert({
  variant = 'info',
  icon,
  title,
  description,
  role,
  className,
  children,
}: AlertProps) {
  const resolvedRole =
    role === 'none'
      ? undefined
      : (role ??
        (variant === 'danger' || variant === 'warning' ? 'alert' : 'status'))

  return (
    <div
      role={resolvedRole}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border p-4',
        alertVariants[variant],
        className,
      )}
    >
      {icon ? <div className="flex items-center gap-2">{icon}</div> : null}
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {children}
    </div>
  )
}

export function AlertTitle({ className, ...props }: AlertDivProps) {
  return <div className={cn('font-medium text-sm', className)} {...props} />
}

export function AlertDescription({ className, ...props }: AlertDivProps) {
  return (
    <div
      className={cn('text-xs leading-5 text-[var(--cx-text-3)]', className)}
      {...props}
    />
  )
}
