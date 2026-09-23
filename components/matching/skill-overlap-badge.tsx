'use client'

import { Sparkles, CheckCircle2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SkillOverlapBadgeProps {
  skill: string
  isOverlap?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function SkillOverlapBadge({
  skill,
  isOverlap = true,
  className,
  size = 'sm',
}: SkillOverlapBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        isOverlap
          ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] border border-[color-mix(in_srgb,var(--cx-brand)_35%,transparent)] shadow-[0_0_8px_rgba(208,164,91,0.15)]'
          : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] border border-[var(--cx-border-1)]',
        className,
      )}
    >
      {isOverlap ? (
        <Sparkles className="size-3 text-[var(--cx-brand)] shrink-0" />
      ) : (
        <CheckCircle2 className="size-3 text-[var(--cx-text-4)] shrink-0" />
      )}
      <span>{skill}</span>
      {isOverlap ? (
        <span className="text-[9px] uppercase tracking-wider text-[var(--cx-brand)] font-semibold ml-0.5">
          Overlap
        </span>
      ) : null}
    </span>
  )
}
