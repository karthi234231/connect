'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface MatchScoreBadgeProps {
  score: number
  factors?: { label: string; value: number }[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MatchScoreBadge({
  score,
  factors = [],
  className,
  size = 'md',
}: MatchScoreBadgeProps) {
  // Score color gradient threshold
  const isHighMatch = score >= 85
  const isMediumMatch = score >= 70

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2 font-semibold',
  }[size]

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full font-medium shadow-xs transition-all',
          sizeClasses,
          isHighMatch
            ? 'bg-gradient-to-r from-[var(--cx-brand)] to-[#e0b874] text-[var(--cx-bg)] font-semibold shadow-[0_0_12px_rgba(208,164,91,0.3)]'
            : isMediumMatch
              ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] border border-[color-mix(in_srgb,var(--cx-brand)_40%,transparent)]'
              : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] border border-[var(--cx-border-1)]',
        )}
      >
        <Sparkles className={cn(size === 'sm' ? 'size-3' : 'size-3.5')} />
        <span>{Math.round(score)}% Match</span>
      </span>

      {factors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {factors.map((factor) => (
            <span
              key={factor.label}
              className="inline-flex items-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2 py-0.5 text-[10px] text-[var(--cx-text-3)]"
            >
              <span className="capitalize">{factor.label}</span>
              <span className="ml-1 font-medium text-[var(--cx-text-2)]">
                {Math.round(factor.value)}%
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
