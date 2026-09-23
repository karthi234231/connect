'use client'

import type { ReactNode } from 'react'
import { ChevronRight, Heart, MessageCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui'
import type { Person } from './person'
import { cn } from '@/utils/cn'

export interface PersonRowProps {
  person: Person
  onClick?: () => void
  liked?: boolean
  onLike?: () => void
  onMessage?: () => void
  trailing?: ReactNode
}

export function PersonRow({
  person,
  onClick,
  liked = false,
  onLike,
  onMessage,
  trailing,
}: PersonRowProps) {
  return (
    <div className="flex items-center gap-3 py-4">
      <Avatar
        avatarClassName="size-11"
        className={cn(person.tone, 'ring-2 ring-[var(--cx-surface-1)]')}
      >
        <AvatarFallback className="text-xs font-semibold text-[#332d3d]">
          {person.initials}
        </AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium hover:underline">
          {person.name}
        </p>
        <p className="truncate text-xs text-[var(--cx-text-3)]">
          {person.note}
          {person.note && person.company ? ' · ' : ''}
          {person.company}
        </p>
      </button>
      {trailing ?? (
        <div className="flex shrink-0 items-center gap-1.5">
          {onLike ? (
            <button
              type="button"
              aria-pressed={liked}
              aria-label={
                liked ? `Unlike ${person.name}` : `Like ${person.name}`
              }
              onClick={onLike}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition',
                liked
                  ? 'bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]'
                  : 'text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
              )}
            >
              <Heart
                className="size-4"
                fill={liked ? 'currentColor' : 'none'}
              />
            </button>
          ) : null}
          {onMessage ? (
            <button
              type="button"
              aria-label={`Message ${person.name}`}
              onClick={onMessage}
              className="flex size-8 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white transition hover:bg-[var(--cx-brand-strong)]"
            >
              <MessageCircle className="size-4" />
            </button>
          ) : null}
          {onClick ? (
            <button
              type="button"
              aria-label={`View ${person.name}`}
              onClick={onClick}
              className="flex size-8 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]"
            >
              <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
