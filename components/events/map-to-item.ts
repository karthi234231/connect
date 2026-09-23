import type { GuestEventDetail, PublicEventCard } from '@/client/api/events'
import type { EventCardData } from '@/types/event'
import type { EventItem } from './event'

const DEFAULT_TONE = 'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)]'

function monthDayParts(iso: string | null | undefined): {
  month: string
  date: string
} {
  if (!iso) return { month: 'TBA', date: '' }
  const dt = new Date(iso)
  const month = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return { month, date: String(dt.getDate()) }
}

function formatFromType(type: string | null | undefined): EventItem['format'] {
  return type === 'irl' ? 'In person' : 'Online'
}

export function publicEventToItem(event: PublicEventCard): EventItem {
  const { month, date } = monthDayParts(event.startsAt)
  return {
    id: event.id,
    month,
    date,
    title: event.title,
    location: event.locationOrLink ?? 'Online',
    format: formatFromType(event.type),
    duration: `${event.durationMinutes} min`,
    attendees: event.attendeeCount,
    capacity: event.capacity,
    tone: DEFAULT_TONE,
    tags: event.tags ?? [],
    startsAt: event.startsAt,
  }
}

export function guestEventToItem(event: GuestEventDetail): EventItem {
  const { month, date } = monthDayParts(event.startsAt)
  return {
    id: event.id,
    month,
    date,
    title: event.title,
    description: event.description ?? undefined,
    location: event.locationOrLink ?? 'Online',
    format: formatFromType(event.type),
    duration: `${event.durationMinutes} min`,
    attendees: event.registeredCount ?? 0,
    capacity: event.capacity,
    category: event.category ?? undefined,
    tone: DEFAULT_TONE,
    tags: event.tags ?? [],
    startsAt: event.startsAt,
  }
}

export function hostedEventToItem(event: EventCardData): EventItem {
  const { month, date } = monthDayParts(event.starts_at)
  return {
    id: event.id,
    month,
    date,
    title: event.title,
    host: 'You',
    location: event.location_or_link ?? 'Online',
    format: formatFromType(event.type),
    duration: '',
    attendees: event.attendeeCount ?? 0,
    capacity: event.capacity ?? 0,
    tone: DEFAULT_TONE,
    tags: [],
    startsAt: event.starts_at,
  }
}
