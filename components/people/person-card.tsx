'use client'

import { Heart, MapPin, Briefcase, Target } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { MatchScoreBadge } from '@/components/matching/match-score-badge'
import { SkillOverlapBadge } from '@/components/matching/skill-overlap-badge'
import { getIntentLabel } from '@/services/profiles/intent'
import type { Person } from './person'
import { cn } from '@/utils/cn'

export interface PersonCardProps {
  person: Person
  liked?: boolean
  onLike?: () => void
  onClick?: () => void
  expanded?: boolean
}

export function PersonCard({
  person,
  liked = false,
  onLike,
  onClick,
  expanded = false,
}: PersonCardProps) {
  const offeringList = (person.offering && person.offering.length > 0)
    ? person.offering
    : (person.tags && person.tags.length > 0 ? person.tags : [])

  const lookingForList = (person.lookingFor && person.lookingFor.length > 0)
    ? person.lookingFor
    : (person.interests && person.interests.length > 0 ? person.interests : [])

  const overlapSet = new Set((person.skillOverlap ?? []).map((s) => s.toLowerCase().trim()))

  return (
    <article className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--cx-border-2)]">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none"
        >
          <Avatar avatarClassName="size-11 shrink-0" className={person.tone}>
            {person.avatarUrl ? (
              <AvatarImage src={person.avatarUrl} alt={person.name} />
            ) : (
              <AvatarFallback className="text-xs font-semibold text-[#332d3d]">
                {person.initials}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--cx-text-1)]">{person.name}</h3>
            {person.role ? (
              <p className="truncate text-xs font-medium text-[var(--cx-brand-strong)]">
                {getIntentLabel(person.role) ?? person.role}
              </p>
            ) : null}
            {person.location ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--cx-text-3)]">
                <MapPin className="size-3 shrink-0 text-[var(--cx-text-4)]" />
                <span className="truncate">{person.location}</span>
              </p>
            ) : null}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {typeof person.score === 'number' ? (
            <MatchScoreBadge score={person.score} size="sm" />
          ) : null}
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            aria-label={liked ? `Unlike ${person.name}` : `Like ${person.name}`}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full transition',
              liked
                ? 'bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]'
                : 'text-[var(--cx-text-4)] hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-2)]',
            )}
          >
            <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {(expanded || person.note) ? (
        <p className="mt-3 text-xs leading-5 text-[var(--cx-text-2)] line-clamp-3">
          {person.note}
        </p>
      ) : null}

      {/* Intent Badges Grid: Offering & Looking For */}
      {(offeringList.length > 0 || lookingForList.length > 0) ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {offeringList.length > 0 ? (
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                <Briefcase className="size-2.5 text-[var(--cx-brand)]" />
                Offering
              </span>
              <div className="flex flex-wrap gap-1">
                {offeringList.slice(0, 3).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2 py-0.5 text-[10px] text-[var(--cx-text-2)]"
                  >
                    {getIntentLabel(item) ?? item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {lookingForList.length > 0 ? (
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                <Target className="size-2.5 text-[var(--cx-info)]" />
                Looking For
              </span>
              <div className="flex flex-wrap gap-1">
                {lookingForList.slice(0, 3).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[var(--cx-brand-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--cx-brand-strong)]"
                  >
                    {getIntentLabel(item) ?? item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {person.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--cx-border-1)] pt-2.5">
          {person.tags.map((tag) => (
            <SkillOverlapBadge
              key={tag}
              skill={tag}
              isOverlap={overlapSet.has(tag.toLowerCase().trim())}
              size="sm"
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}
