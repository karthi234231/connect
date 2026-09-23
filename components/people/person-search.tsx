'use client'

import { Filter, X } from 'lucide-react'
import { Chip } from '@/components/ui'

export interface PersonSearchProps {
  query: string
  onQueryChange: (query: string) => void
  facets?: string[]
  selectedFacets?: string[]
  onFacetChange?: (facet: string) => void
  resultsCount?: number
  onClear?: () => void
  featured?: string
}

export function PersonSearch({
  query,
  onQueryChange: _onQueryChange,
  facets = [],
  selectedFacets = [],
  onFacetChange,
  resultsCount,
  onClear,
  featured,
}: PersonSearchProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <Filter className="size-3.5 shrink-0 text-[var(--cx-text-3)]" />
        {featured ? (
          <span className="shrink-0 rounded-full border border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--cx-brand-strong)]">
            {featured}
          </span>
        ) : null}
        {facets.map((facet) => {
          const active = selectedFacets.includes(facet)
          return (
            <Chip
              key={facet}
              active={active}
              aria-pressed={active}
              onClick={() => onFacetChange?.(facet)}
            >
              {facet}
            </Chip>
          )
        })}
      </div>
      {query ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-[var(--cx-text-3)]">
            Results for &quot;{query}&quot;
            {resultsCount !== undefined ? ` · ${resultsCount}` : ''}
          </p>
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            disabled={!onClear}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-4)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
