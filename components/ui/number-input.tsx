'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  ariaLabel?: string
}

function clampToBounds(value: number, min?: number, max?: number): number {
  let next = value
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  return next
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-5 items-center justify-center rounded-full text-[var(--cx-text-3)] transition',
        'hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  )
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onValueChange,
      min,
      max,
      step = 1,
      disabled,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const atMin = min !== undefined && value <= min
    const atMax = max !== undefined && value >= max

    const changeBy = (direction: number) => {
      const next = clampToBounds(
        Number((value + direction * step).toPrecision(12)),
        min,
        max,
      )
      onValueChange?.(next)
    }

    return (
      <div className={cn('relative', className)}>
        <input
          ref={ref}
          {...props}
          type="number"
          value={value}
          aria-label={ariaLabel}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            if (!Number.isNaN(next)) {
              onValueChange?.(clampToBounds(next, min, max))
            }
          }}
          className={cn(
            'w-full rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 pr-11 text-sm outline-none',
            'placeholder:text-[var(--cx-text-4)]',
            'focus:border-[var(--cx-brand)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 flex-col gap-0.5">
          <StepperButton
            label="Increase value"
            disabled={disabled || atMax}
            onClick={() => changeBy(1)}
          >
            <ChevronUp className="size-3" />
          </StepperButton>
          <StepperButton
            label="Decrease value"
            disabled={disabled || atMin}
            onClick={() => changeBy(-1)}
          >
            <ChevronDown className="size-3" />
          </StepperButton>
        </div>
      </div>
    )
  },
)
NumberInput.displayName = 'NumberInput'
