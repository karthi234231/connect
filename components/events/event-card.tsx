'use client'

import { Bookmark, Calendar, Check, Download, Globe, MapPin, Sparkles, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AvatarGroup, type AvatarGroupItem } from '@/components/ui/avatar-group'
import { Badge } from '@/components/ui/badge'
import type { EventItem } from './event'

export interface EventCardProps {
  event: EventItem
  saved?: boolean
  registered?: boolean
  attendeeAvatars?: AvatarGroupItem[]
  onSave?: () => void
  onRegister?: () => void
  onExportIcs?: () => void
  onOpen?: () => void
  footerAction?: ReactNode
}

export function EventCard({
  event,
  saved = false,
  registered = false,
  attendeeAvatars,
  onSave,
  onRegister,
  onExportIcs,
  onOpen,
  footerAction,
}: EventCardProps) {
  // Generate sample attendee avatar items if not provided explicitly
  const defaultAvatars: AvatarGroupItem[] = Array.from(
    { length: Math.min(event.attendees || 3, 5) },
    (_, i) => {
      const sampleNames = [
        'Alex Rivera',
        'Taylor Chen',
        'Sam Kim',
        'Jordan Smith',
        'Morgan Lee',
      ]
      const name = sampleNames[i % sampleNames.length]
      const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
      return {
        alt: name,
        initials,
      }
    },
  )

  const avatarsToRender = attendeeAvatars ?? defaultAvatars
  const isOnline = event.format === 'Online'
  const spotsLeft = event.capacity > 0 ? event.capacity - event.attendees : null
  const isFull = event.capacity > 0 && spotsLeft !== null && spotsLeft <= 0

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[var(--cx-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--cx-brand)]/40">
      {/* Banner / Header Image Area */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View details for ${event.title}`}
        className={cn(
          'relative block h-[124px] w-full bg-gradient-to-br text-left p-3.5',
          event.tone ?? 'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)]',
        )}
      >
        <span className="pointer-events-none absolute -right-6 -top-10 size-28 rounded-full bg-white/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-12 right-12 size-32 rounded-full bg-black/10 blur-2xl" />

        {/* Date Badge Chip */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-[#322b3a] shadow-sm backdrop-blur-sm">
            <Calendar className="size-3 text-[#322b3a]" />
            {event.month} {event.date}
          </span>

          {/* Badges: Category & Format */}
          <div className="flex items-center gap-1.5">
            {event.category ? (
              <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
                {event.category.toUpperCase()}
              </span>
            ) : null}
            {event.format ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
                {isOnline ? <Globe className="size-3" /> : <MapPin className="size-3" />}
                {event.format}
              </span>
            ) : null}
          </div>
        </div>

        {/* Host Avatar Badge Chip on banner bottom */}
        {event.host ? (
          <div className="absolute bottom-3 left-3.5 flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 backdrop-blur-md">
            <Avatar className="size-4 bg-[var(--cx-brand)] text-white">
              {event.hostAvatar ? (
                <AvatarImage src={event.hostAvatar} alt={event.host} />
              ) : (
                <AvatarFallback className="text-[9px] text-white">
                  {event.hostInitials ?? 'H'}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="text-[10px] font-medium text-white/90 truncate max-w-[120px]">
              {event.host}
            </span>
          </div>
        ) : null}
      </button>

      {/* Card Content */}
      <div className="p-3.5">
        <div className="flex items-start gap-2 justify-between">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onOpen} className="block text-left">
              <h2 className="font-display text-[17px] font-semibold leading-tight tracking-[-0.02em] text-[var(--cx-text-1)] transition group-hover:text-[var(--cx-brand-strong)]">
                {event.title}
              </h2>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onExportIcs ? (
              <button
                type="button"
                onClick={onExportIcs}
                aria-label={`Export .ics calendar invite for ${event.title}`}
                title="Export .ics calendar invite"
                className="flex size-7 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-3)] transition hover:border-[var(--cx-brand)] hover:text-[var(--cx-brand-strong)] hover:bg-[var(--cx-surface-2)]"
              >
                <Download className="size-3.5" />
              </button>
            ) : null}
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                aria-label={saved ? 'Remove from saved events' : 'Save event'}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border transition',
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
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--cx-text-3)]">
          <MapPin className="size-3.5 shrink-0 text-[var(--cx-brand)]" />
          <span className="truncate">
            {event.location}
            {event.duration ? ` · ${event.duration}` : ''}
          </span>
        </p>

        {/* Attendee Avatars Preview */}
        {avatarsToRender.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] p-2">
            <div className="flex items-center gap-2 min-w-0">
              <AvatarGroup items={avatarsToRender} size="sm" max={3} />
              <span className="text-[11px] font-medium text-[var(--cx-text-2)] truncate">
                {event.attendees > 0
                  ? `${event.attendees} registered`
                  : 'Be the first to join!'}
              </span>
            </div>

            {isFull ? (
              <Badge variant="warning">Full</Badge>
            ) : spotsLeft !== null && spotsLeft <= 5 ? (
              <Badge variant="danger">{spotsLeft} left</Badge>
            ) : null}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <footer className="flex items-center justify-between gap-2 border-t border-[var(--cx-border-1)] px-3.5 py-2.5 bg-[var(--cx-surface-1)]">
        <span className="text-[11px] font-medium text-[var(--cx-text-3)]">
          {event.capacity > 0
            ? spotsLeft !== null && spotsLeft > 0
              ? `${spotsLeft} spots remaining`
              : 'At capacity'
            : `${event.attendees} going`}
        </span>

        {footerAction ??
          (onRegister ? (
            <button
              type="button"
              onClick={onRegister}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition',
                registered
                  ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] border border-[var(--cx-brand)]/30'
                  : 'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)] shadow-sm',
              )}
            >
              {registered ? <Check className="size-3.5" /> : null}
              {registered ? 'Going' : isFull ? 'Waitlist' : 'Register'}
            </button>
          ) : null)}
      </footer>
    </article>
  )
}
