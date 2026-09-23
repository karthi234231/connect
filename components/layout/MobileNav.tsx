import type { NavItem } from './DesktopNav'
import { cn } from '@/utils/cn'

type MobileNavProps = {
  items: NavItem[]
  activeLabel?: string
  onNavigate?: (label: string) => void
  className?: string
}

export function MobileNav({
  items,
  activeLabel,
  onNavigate,
  className,
}: MobileNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-2 lg:hidden',
        className,
      )}
    >
      <div className="mx-auto flex max-w-md items-center justify-around rounded-[22px] border border-white/10 bg-[color:var(--cx-surface-1)/.58] px-1 py-1.5 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur-md">
        {items.map(({ label, icon: Icon, activeCount }) => {
          const active = label === activeLabel
          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate?.(label)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[16px] px-0.5 py-1.5 text-[10px] transition-colors',
                active
                  ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                  : 'text-[var(--cx-text-4)] hover:bg-white/5',
              )}
            >
              <Icon className="size-[18px]" />
              <span className="text-[9px] leading-none sm:text-[10px]">
                {label}
              </span>
              {activeCount ? (
                <span className="absolute right-[21%] top-0 flex size-3 items-center justify-center rounded-full border border-white/15 bg-[color:var(--cx-brand)/.24] text-[8px] font-semibold text-[var(--cx-text-1)] backdrop-blur-sm">
                  {activeCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
