'use client'

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  siblings?: number
  boundaryCount?: number
  className?: string
}

type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

function range(start: number, end: number): number[] {
  const values: number[] = []
  for (let i = start; i <= end; i += 1) values.push(i)
  return values
}

function computePageItems(
  page: number,
  pageCount: number,
  siblings: number,
  boundaryCount: number,
): PageItem[] {
  const candidates = new Set<number>()
  range(1, Math.min(boundaryCount, pageCount)).forEach((p) => candidates.add(p))
  range(1, siblings).forEach((offset) => {
    candidates.add(page - offset)
    candidates.add(page + offset)
  })
  candidates.add(page)
  range(Math.max(pageCount - boundaryCount + 1, 1), pageCount).forEach((p) =>
    candidates.add(p),
  )

  const sorted = Array.from(candidates)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)

  const items: PageItem[] = []
  let prev = 0
  for (const item of sorted) {
    if (prev > 0 && item - prev > 1) {
      items.push(prev === 1 ? 'ellipsis-start' : 'ellipsis-end')
    }
    items.push(item)
    prev = item
  }
  return items
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  boundaryCount = 1,
  className,
}: PaginationProps) {
  const items = computePageItems(page, pageCount, siblings, boundaryCount)

  return (
    <nav aria-label="Pagination" className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Previous page</span>
          </button>
        </li>
        {items.map((item) => {
          if (item === 'ellipsis-start' || item === 'ellipsis-end') {
            return (
              <li key={item}>
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center"
                >
                  <MoreHorizontal className="size-4 text-[var(--cx-text-4)]" />
                </span>
              </li>
            )
          }
          const isCurrent = item === page
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)]',
                  isCurrent
                    ? 'bg-[var(--cx-brand)] text-white'
                    : 'text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
                )}
              >
                {item}
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--cx-brand)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Next page</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
