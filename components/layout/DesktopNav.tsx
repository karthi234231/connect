import type { ComponentType } from 'react'
import { FocusRing } from '@/components/a11y'
import { cn } from '@/utils/cn'

export type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  activeCount?: number
}

type DesktopNavProps = {
  items: NavItem[]
  activeLabel?: string
  onNavigate?: (label: string) => void
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function DesktopNav({
  items,
  activeLabel,
  onNavigate,
  orientation = 'vertical',
  className,
}: DesktopNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        'flex gap-1',
        orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center',
        className,
      )}
    >
      {items.map(({ label, icon: Icon, activeCount }) => {
        const active = label === activeLabel
        return (
          <FocusRing key={label}>
            <button
              type="button"
              onClick={() => onNavigate?.(label)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition',
                orientation === 'vertical' ? 'w-full' : '',
                active
                  ? 'bg-[var(--cx-brand-soft)] font-medium text-[var(--cx-brand-strong)]'
                  : 'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
              )}
            >
              <Icon className="size-[18px]" />
              <span>{label}</span>
              {activeCount ? (
                <span className="ml-auto rounded-full bg-[var(--cx-brand)] px-1.5 py-0.5 text-[10px] text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </FocusRing>
        )
      })}
    </nav>
  )
}
