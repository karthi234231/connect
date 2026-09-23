'use client'

import { useState, useEffect } from 'react'
import {
  SlidersHorizontal,
  RotateCcw,
  Check,
  Globe,
  Briefcase,
  UserCheck2,
  Sparkles,
} from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

export interface DiscoverFilterState {
  intents: string[]
  role: string | null
  region: string | null
  workStyle: string | null
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilterState = {
  intents: [],
  role: null,
  region: null,
  workStyle: null,
}

export const INTENT_OPTIONS = [
  {
    id: 'Co-founder',
    label: 'Co-founder',
    desc: 'Seeking a co-founding partner for 0-to-1 build',
  },
  {
    id: 'Collaborator',
    label: 'Collaborator',
    desc: 'Project contributor, builder, or peer partner',
  },
  {
    id: 'Advisor',
    label: 'Advisor',
    desc: 'Strategic advisor or domain specialist',
  },
  {
    id: 'Mentor',
    label: 'Mentor',
    desc: 'Experienced leader offering guidance & coaching',
  },
] as const

export const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'designer', label: 'Designer' },
  { value: 'product', label: 'Product' },
  { value: 'growth', label: 'Growth' },
  { value: 'operations', label: 'Operations' },
  { value: 'data_ml', label: 'Data & ML' },
  { value: 'other', label: 'Other' },
] as const

export const REGION_OPTIONS = [
  { value: 'America', label: 'Americas' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Oceania', label: 'Oceania' },
] as const

export const WORK_STYLE_OPTIONS = [
  { value: 'flexible', label: 'Flexible / Remote-first' },
  { value: 'fast_iterate', label: 'Fast Iterate / Rapid Shipping' },
  { value: 'structured', label: 'Structured / Scheduled' },
] as const

export interface DiscoverFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: DiscoverFilterState
  onApplyFilters: (filters: DiscoverFilterState) => void
  onResetFilters: () => void
}

export function DiscoverFilterDrawer({
  open,
  onOpenChange,
  filters,
  onApplyFilters,
  onResetFilters,
}: DiscoverFilterDrawerProps) {
  const [draft, setDraft] = useState<DiscoverFilterState>(filters)

  // Synchronize draft state whenever drawer opens or external filters update
  useEffect(() => {
    if (open) {
      setDraft(filters)
    }
  }, [open, filters])

  const toggleIntent = (intentId: string) => {
    setDraft((prev) => {
      const exists = prev.intents.includes(intentId)
      return {
        ...prev,
        intents: exists
          ? prev.intents.filter((i) => i !== intentId)
          : [...prev.intents, intentId],
      }
    })
  }

  const activeCount =
    draft.intents.length +
    (draft.role ? 1 : 0) +
    (draft.region ? 1 : 0) +
    (draft.workStyle ? 1 : 0)

  const handleReset = () => {
    setDraft(DEFAULT_DISCOVER_FILTERS)
    onResetFilters()
    onOpenChange(false)
  }

  const handleApply = () => {
    onApplyFilters(draft)
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      label="Filter Candidates"
      header={
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-[var(--cx-brand)]" />
          <span>Filter Candidates</span>
          {activeCount > 0 ? (
            <Badge variant="brand" className="ml-2">
              {activeCount} active
            </Badge>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6 py-2">
        {/* 1. Collaboration Intent */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck2 className="size-4 text-[var(--cx-brand)]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-1)]">
                Collaboration Intent
              </h4>
            </div>
            {draft.intents.length > 0 ? (
              <span className="text-[11px] font-medium text-[var(--cx-brand-strong)]">
                {draft.intents.length} selected
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[var(--cx-text-3)]">
            Filter profiles by target collaboration capacity.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INTENT_OPTIONS.map((opt) => {
              const selected = draft.intents.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleIntent(opt.id)}
                  className={cn(
                    'flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-all',
                    selected
                      ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)]/60 text-[var(--cx-text-1)] shadow-xs'
                      : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-2)]',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="font-display text-xs font-bold">
                      {opt.label}
                    </span>
                    {selected ? (
                      <Check className="size-3.5 text-[var(--cx-brand-strong)]" />
                    ) : null}
                  </div>
                  <span className="mt-1 text-[10px] leading-tight text-[var(--cx-text-3)]">
                    {opt.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px w-full bg-[var(--cx-border-1)]" />

        {/* 2. Candidate Role */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-[var(--cx-brand)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-1)]">
              Candidate Role
            </h4>
          </div>
          <p className="text-xs text-[var(--cx-text-3)]">
            Select a specific primary discipline or role.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, role: null }))}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                draft.role === null
                  ? 'bg-[var(--cx-brand)] text-[var(--cx-bg)] shadow-xs'
                  : 'border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
              )}
            >
              All Roles
            </button>
            {ROLE_OPTIONS.map((r) => {
              const selected = draft.role === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, role: r.value }))}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-[var(--cx-brand)] text-[var(--cx-bg)] shadow-xs'
                      : 'border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
                  )}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px w-full bg-[var(--cx-border-1)]" />

        {/* 3. Location / Region */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[var(--cx-brand)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-1)]">
              Location / Region
            </h4>
          </div>
          <p className="text-xs text-[var(--cx-text-3)]">
            Filter by geographical timezone region.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, region: null }))}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                draft.region === null
                  ? 'bg-[var(--cx-brand)] text-[var(--cx-bg)] shadow-xs'
                  : 'border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
              )}
            >
              Any Region
            </button>
            {REGION_OPTIONS.map((reg) => {
              const selected = draft.region === reg.value
              return (
                <button
                  key={reg.value}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, region: reg.value }))}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-[var(--cx-brand)] text-[var(--cx-bg)] shadow-xs'
                      : 'border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
                  )}
                >
                  {reg.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px w-full bg-[var(--cx-border-1)]" />

        {/* 4. Remote / Work Style Preference */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--cx-brand)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--cx-text-1)]">
              Remote / Work Style Preference
            </h4>
          </div>
          <p className="text-xs text-[var(--cx-text-3)]">
            Filter candidate preferences for execution rhythm and structure.
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, workStyle: null }))}
              className={cn(
                'w-full rounded-xl border p-2.5 text-left text-xs font-medium transition-colors',
                draft.workStyle === null
                  ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                  : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
              )}
            >
              Any Work Style
            </button>
            {WORK_STYLE_OPTIONS.map((ws) => {
              const selected = draft.workStyle === ws.value
              return (
                <button
                  key={ws.value}
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({ ...p, workStyle: ws.value }))
                  }
                  className={cn(
                    'w-full rounded-xl border p-2.5 text-left text-xs font-medium transition-colors',
                    selected
                      ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                      : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-2)]',
                  )}
                >
                  {ws.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-[var(--cx-border-1)]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-3.5" />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleApply}
          >
            Apply Filters {activeCount > 0 ? `(${activeCount})` : ''}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
