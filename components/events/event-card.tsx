'use client'

import { Bookmark, Check, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import type { EventItem } from './event'

export interface EventCardProps {
  event: EventItem
  saved?: boolean
  registered?: boolean
  onSave?: () => void
  onRegister?: () => void
  onOpen?: () => void
  footerAction?: ReactNode
}

export function EventCard({
  event,
  saved = false,
  registered = false,
  onSave,
  onRegister,
  onOpen,
  footerAction,
}: EventCardProps) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[var(--cx-shadow-card)] transition hover:-translate-y-0.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View details for ${event.title}`}
        className={cn(
          'relative block h-[118px] w-full bg-gradient-to-br text-left',
          event.tone ?? 'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)]',
        )}
      >
        <span className="pointer-events-none absolute -right-6 -top-10 size-28 rounded-full bg-white/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-12 right-12 size-32 rounded-full bg-black/10 blur-2xl" />
        <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-[#322b3a]">
          {event.month} {event.date}
        </span>
        {event.category || event.format ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/20 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
            {event.category ?? event.format}
          </span>
        ) : null}
      </button>

      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onOpen} className="block text-left">
              <h2 className="font-display text-[17px] leading-tight tracking-[-0.02em] text-[var(--cx-text-1)] transition group-hover:text-[var(--cx-brand-strong)]">
                {event.title}
              </h2>
            </button>
            {event.host ? (
              <p className="mt-0.5 text-[11px] font-medium text-[var(--cx-text-2)]">
                {event.host}
              </p>
            ) : null}
          </div>
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              aria-label={saved ? 'Remove from saved events' : 'Save event'}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border transition',
                saved
                  ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                  : 'border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:border-[var(--cx-border-2)] hover:text-[var(--cx-text-1)]',
              )}
            >
              {saved ? (
                <Check className="size-3.5" />
              ) : (
                <Bookmark className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>

        <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--cx-text-3)]">
          <MapPin className="size-3 shrink-0" />
          <span>
            {event.location}
            {event.duration ? ` · ${event.duration}` : ''}
          </span>
        </p>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-[var(--cx-border-1)] p-3 pt-2.5">
        <span className="text-[10px] text-[var(--cx-text-3)]">
          ({event.attendees} going · {event.capacity - event.attendees} spots
          left)
        </span>
        {footerAction ??
          (onRegister ? (
            <button
              type="button"
              onClick={onRegister}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
                registered
                  ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                  : 'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)]',
              )}
            >
              {registered && <Check className="size-3" />}
              {registered ? 'Going' : 'Register'}
            </button>
          ) : null)}
      </footer>
    </article>
  )
}
