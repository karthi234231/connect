import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: ReactNode
  href?: never
  onClick?: () => void
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: ReactNode
  className?: string
}

export function Breadcrumb({ items, separator, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0
                ? (separator ?? (
                    <ChevronRight
                      className="size-3.5 text-[var(--cx-text-4)]"
                      aria-hidden="true"
                    />
                  ))
                : null}
              {isLast ? (
                <span
                  aria-current="page"
                  className="pointer-events-none text-xs font-medium text-[var(--cx-text-1)]"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="rounded text-xs text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)]"
                >
                  {item.label}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
