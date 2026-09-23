// src/lib/dto-events.ts
// W3.8 / §2.4 — Event, Thread and Message DTO projections (pure, testable).

import { z } from 'zod'

// ─── Event rows & EventSummaryDTO ───────────────────────────────────────────

export interface EventRow {
  id: string
  host_id: string
  title: string
  description?: string | null
  type?: string | null
  format?: string | null
  location_or_link?: string | null
  starts_at?: string | null
  duration_minutes?: number | null
  capacity?: number | null
  tags?: string[] | null
  recurrence?: string | null
  attendee_count?: number | null
  is_going?: boolean | null
  [key: string]: unknown
}

export const EventSummaryDTOSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    type: z.enum(['virtual', 'irl']),
    format: z.string(),
    locationOrLink: z.string().nullable(),
    startsAt: z.string(),
    durationMinutes: z.number(),
    capacity: z.number(),
    tags: z.array(z.string()),
    attendeeCount: z.number(),
    isGoing: z.boolean(),
  })
  .strict()

export type EventSummaryDTO = z.infer<typeof EventSummaryDTOSchema>

/** Project a raw events row into the scan-first EventSummaryDTO. */
export function toEventSummaryDTO(row: EventRow): EventSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    type: row.type === 'irl' ? 'irl' : 'virtual',
    format: row.format ?? 'social',
    locationOrLink: row.location_or_link ?? null,
    startsAt: row.starts_at ?? new Date(0).toISOString(),
    durationMinutes: row.duration_minutes ?? 60,
    capacity: row.capacity ?? 0,
    tags: row.tags ?? [],
    attendeeCount: row.attendee_count ?? 0,
    isGoing: row.is_going ?? false,
  }
}

// ─── Guest event detail DTO + public-listing pagination (pure) ─────────────

/**
 * Row shape read back from the `public_events` listing view (HOST-PRIV-02).
 * Only browse-safe columns; no organizer identity or attendee PII.
 */
export interface GuestEventDetailRow {
  id: string
  title: string
  description?: string | null
  type?: string | null
  format?: string | null
  location_or_link?: string | null
  starts_at?: string | null
  duration_minutes?: number | null
  capacity?: number | null
  tags?: string[] | null
  cover_image?: string | null
  timezone?: string | null
  venue?: unknown
  price?: number | null
  currency?: string | null
  category?: string | null
}

/**
 * Aggregate availability for a single event. All fields are nullable because
 * the guest-safe counts path (service-role client) may be unavailable or fail
 * — the UI renders `—` in those cases, never a fabricated number.
 */
export interface GuestEventRegistrationCounts {
  capacity: number | null
  registeredCount: number | null
  waitlistCount: number | null
  /** Derived client-side from capacity + registeredCount; optional input. */
  spotsRemaining?: number | null
  /** Derived client-side from capacity + registeredCount; optional input. */
  isFull?: boolean | null
  registrationOpen: boolean | null
}

export const EMPTY_GUEST_EVENT_COUNTS: GuestEventRegistrationCounts = {
  capacity: null,
  registeredCount: null,
  waitlistCount: null,
  spotsRemaining: null,
  isFull: null,
  registrationOpen: null,
}

export interface GuestEventDetailDTO {
  id: string
  title: string
  description: string | null
  type: 'virtual' | 'irl'
  format: string
  locationOrLink: string | null
  startsAt: string
  durationMinutes: number
  capacity: number
  tags: string[]
  coverImage: string | null
  timezone: string | null
  venue: unknown
  price: number
  currency: string | null
  category: string | null
  registeredCount: number | null
  waitlistCount: number | null
  spotsRemaining: number | null
  isFull: boolean | null
  registrationOpen: boolean | null
}

/** Project a `public_events` row (+ optional counts) into the detail DTO. */
export function toGuestEventDetailDTO(
  row: GuestEventDetailRow,
  counts?: GuestEventRegistrationCounts | null,
): GuestEventDetailDTO {
  const c = counts ?? EMPTY_GUEST_EVENT_COUNTS

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    type: row.type === 'irl' ? 'irl' : 'virtual',
    format: row.format ?? 'social',
    locationOrLink: row.location_or_link ?? null,
    startsAt: row.starts_at ?? new Date(0).toISOString(),
    durationMinutes: row.duration_minutes ?? 60,
    capacity: row.capacity ?? 0,
    tags: row.tags ?? [],
    coverImage: row.cover_image ?? null,
    timezone: row.timezone ?? null,
    venue: row.venue ?? null,
    price: row.price ?? 0,
    currency: row.currency ?? null,
    category: row.category ?? null,
    registeredCount: c.registeredCount,
    waitlistCount: c.waitlistCount,
    spotsRemaining:
      c.capacity != null && c.registeredCount != null
        ? Math.max(c.capacity - c.registeredCount, 0)
        : null,
    isFull:
      c.capacity != null && c.registeredCount != null
        ? c.registeredCount >= c.capacity
        : null,
    registrationOpen: c.registrationOpen,
  }
}

/** Clamp a guest listing page-size into the 1..50 contract (default 20). */
export function clampGuestLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 20
  }
  return Math.min(Math.max(Math.trunc(value), 1), 50)
}

export interface GuestEventsCursor {
  startsAt: string
  id: string
}

/**
 * Opaque keyset cursor for the guest events feed. Traverses the
 * `ORDER BY starts_at ASC, id ASC` index without OFFSET; the client treats it
 * as an opaque string and the server is the only decoder.
 */
export function encodeGuestEventsCursor(startsAt: string, id: string): string {
  return btoa(JSON.stringify({ s: startsAt, i: id }))
}

/** Decode a guest events cursor; returns null for any malformed input. */
export function decodeGuestEventsCursor(
  cursor?: string | null,
): GuestEventsCursor | null {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    return null
  }
  if (cursor.length > 400) {
    return null
  }
  try {
    const parsed = JSON.parse(atob(cursor)) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).s === 'string' &&
      typeof (parsed as Record<string, unknown>).i === 'string'
    ) {
      const { s, i } = parsed as { s: string; i: string }
      if (s.length > 0 && s.length <= 64 && i.length > 0 && i.length <= 64) {
        return { startsAt: s, id: i }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── ThreadSummaryDTO ───────────────────────────────────────────────────────

export interface ThreadRow {
  matchId: string
  otherUserId: string
  otherName: string
  otherAvatarUrl?: string | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  unreadCount?: number
}

export const ThreadSummaryDTOSchema = z
  .object({
    matchId: z.string().uuid(),
    otherUserId: z.string().uuid(),
    otherName: z.string(),
    otherAvatarUrl: z.string().url().nullable(),
    lastMessage: z.string().nullable(),
    lastMessageAt: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  })
  .strict()

export type ThreadSummaryDTO = z.infer<typeof ThreadSummaryDTOSchema>

/** Project a conversation summary into ThreadSummaryDTO. */
export function toThreadSummaryDTO(row: ThreadRow): ThreadSummaryDTO {
  return {
    matchId: row.matchId,
    otherUserId: row.otherUserId,
    otherName: row.otherName,
    otherAvatarUrl: row.otherAvatarUrl ?? null,
    lastMessage: row.lastMessage ?? null,
    lastMessageAt: row.lastMessageAt ?? null,
    unreadCount: row.unreadCount ?? 0,
  }
}

// ─── MessagePageDTO ─────────────────────────────────────────────────────────

export interface MessageRow {
  id: string
  senderId: string
  content: string
  attachmentUrl?: string | null
  readAt?: string | null
  createdAt: string
}

export const MessagePageDTOMessageSchema = z
  .object({
    id: z.string().uuid(),
    senderId: z.string().uuid(),
    content: z.string(),
    attachmentUrl: z.string().url().nullable(),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()

export const MessagePageDTOSchema = z.object({
  matchId: z.string().uuid(),
  messages: z.array(MessagePageDTOMessageSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
})

export type MessagePageDTO = z.infer<typeof MessagePageDTOSchema>

/** Project a message page into MessagePageDTO. */
export function toMessagePageDTO(input: {
  matchId: string
  messages: MessageRow[]
  hasMore: boolean
  nextCursor?: string
}): MessagePageDTO {
  return {
    matchId: input.matchId,
    messages: input.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      attachmentUrl: m.attachmentUrl ?? null,
      readAt: m.readAt ?? null,
      createdAt: m.createdAt,
    })),
    hasMore: input.hasMore,
    nextCursor: input.nextCursor ?? null,
  }
}
