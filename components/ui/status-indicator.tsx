import { cn } from '@/utils/cn'

export type StatusTone =
  'success' | 'brand' | 'info' | 'warning' | 'danger' | 'neutral' | 'ember'

export type StatusSize = 'sm' | 'md' | 'lg'

export interface StatusDotProps {
  tone?: StatusTone
  pulse?: boolean
  size?: StatusSize
  label?: string
  className?: string
}

const statusTones: Record<StatusTone, string> = {
  success: 'bg-[var(--cx-success)]',
  brand: 'bg-[var(--cx-brand)]',
  info: 'bg-[var(--cx-info)]',
  warning: 'bg-[var(--cx-ember)]',
  danger: 'bg-[var(--cx-danger)]',
  neutral: 'bg-[var(--cx-text-4)]',
  ember: 'bg-[var(--cx-ember)]',
}

const statusSizes: Record<StatusSize, string> = {
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
}

const toneBg = (tone: StatusTone) => statusTones[tone]

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  size = 'sm',
  label,
  className,
}: StatusDotProps) {
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 rounded-full',
        statusSizes[size],
        toneBg(tone),
      )}
    >
      {pulse ? (
        <span
          className={cn(
            'absolute inset-0 animate-ping rounded-full opacity-60',
            toneBg(tone),
          )}
        />
      ) : null}
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )

  if (!label) {
    return dot
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] text-[var(--cx-text-3)]',
        className,
      )}
    >
      {dot}
      {label}
    </span>
  )
}

export interface StatusPillProps {
  label: string
  tone?: StatusTone
  className?: string
}

export function StatusPill({
  label,
  tone = 'neutral',
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]',
        className,
      )}
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  )
}
