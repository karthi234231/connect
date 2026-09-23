import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface FormFieldProps {
  id: string
  label?: ReactNode
  description?: ReactNode
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  id,
  label,
  description,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="font-medium text-sm text-[var(--cx-text-2)]"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--cx-danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <FormError id={`${id}-error`}>{error}</FormError>
      ) : description ? (
        <FormHint id={`${id}-description`}>{description}</FormHint>
      ) : null}
    </div>
  )
}

export interface FormHintProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode
}

export function FormHint({ className, children, ...props }: FormHintProps) {
  return (
    <span
      className={cn('text-xs text-[var(--cx-text-3)]', className)}
      {...props}
    >
      {children}
    </span>
  )
}

export interface FormErrorProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode
}

export function FormError({ className, children, ...props }: FormErrorProps) {
  return (
    <span
      aria-live="polite"
      role="alert"
      className={cn('text-xs text-[var(--cx-danger)]', className)}
      {...props}
    >
      {children}
    </span>
  )
}
