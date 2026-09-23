import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Checkbox, Switch } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface SettingsRowProps {
  title: string
  description?: string
  toggle?: boolean
  /** Toggle control rendered for `toggle` rows — keeps Switch callers unchanged. */
  variant?: 'switch' | 'checkbox'
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  trailing?: ReactNode
}

export function SettingsRow({
  title,
  description,
  toggle = false,
  variant = 'switch',
  checked = false,
  onCheckedChange,
  disabled = false,
  trailing,
}: SettingsRowProps) {
  const rowClass =
    'flex w-full items-center justify-between gap-3 p-3 text-left border-b border-[var(--cx-border-1)] last:border-b-0 transition hover:bg-[var(--cx-surface-2)]'

  const label = (
    <span className="min-w-0">
      <span className="block text-sm font-medium text-[var(--cx-text-1)]">
        {title}
      </span>
      {description ? (
        <span className="mt-0.5 block text-xs leading-5 text-[var(--cx-text-3)]">
          {description}
        </span>
      ) : null}
    </span>
  )

  if (toggle) {
    return (
      <label
        className={cn(
          rowClass,
          'cursor-pointer',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {label}
        {variant === 'checkbox' ? (
          <Checkbox
            checked={checked}
            onCheckedChange={onCheckedChange ?? (() => {})}
            disabled={disabled}
            ariaLabel={title}
          />
        ) : (
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange ?? (() => {})}
            disabled={disabled}
            aria-label={title}
          />
        )}
      </label>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(rowClass, disabled && 'cursor-not-allowed opacity-60')}
    >
      {label}
      {trailing ?? (
        <ChevronRight className="size-4 shrink-0 text-[var(--cx-text-4)]" />
      )}
    </button>
  )
}
