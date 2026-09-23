'use client'

import { Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
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
  return (
    <article className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--cx-border-2)]">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
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
            <h3 className="truncate text-sm font-medium">{person.name}</h3>
            {person.role ? (
              <p className="truncate text-xs text-[var(--cx-text-3)]">
                {person.role}
              </p>
            ) : null}
            {person.company ? (
              <p className="truncate text-xs text-[var(--cx-text-4)]">
                {person.company}
              </p>
            ) : null}
          </span>
        </button>
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
      {expanded && person.note ? (
        <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
          {person.note}
        </p>
      ) : null}
      {person.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {person.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--cx-surface-3)] px-2 py-1 text-[10px] text-[var(--cx-text-3)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}
