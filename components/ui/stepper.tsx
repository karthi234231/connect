import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface StepperStep {
  label: string
  description?: string
}

export interface StepperProps {
  steps: StepperStep[]
  current: number
  className?: string
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol role="list" className={cn('flex items-start', className)}>
      {steps.map((step, index) => {
        const completed = index < current
        const isCurrent = index === current
        return (
          <li
            key={step.label}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex flex-1 flex-col items-center"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  completed &&
                    'bg-[var(--cx-brand)] text-white [&>svg]:text-white',
                  isCurrent &&
                    'border-2 border-[var(--cx-brand)] bg-transparent font-medium text-[var(--cx-brand-strong)]',
                  !completed &&
                    !isCurrent &&
                    'bg-[var(--cx-surface-3)] text-[var(--cx-text-4)]',
                )}
              >
                {completed ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1',
                    completed
                      ? 'bg-[var(--cx-brand)]'
                      : 'bg-[var(--cx-border-1)]',
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                'mt-2 text-center text-xs',
                isCurrent || completed
                  ? 'font-medium text-[var(--cx-text-1)]'
                  : 'text-[var(--cx-text-3)]',
              )}
            >
              {step.label}
            </span>
            {step.description ? (
              <span className="mt-0.5 text-center text-[11px] text-[var(--cx-text-4)]">
                {step.description}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
