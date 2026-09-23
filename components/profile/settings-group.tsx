import type { ReactNode } from 'react'

export interface SettingsGroupProps {
  title: string
  children?: ReactNode
  className?: string
}

export function SettingsGroup({
  title,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <section className={className} aria-label={title}>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
        {title}
      </p>
      <div className="overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        {children}
      </div>
    </section>
  )
}
