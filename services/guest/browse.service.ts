// src/services/guest/browse.service.ts

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { tryGetAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import {
  type GuestEventRegistrationCounts,
  EMPTY_GUEST_EVENT_COUNTS,
  type GuestEventDetailDTO,
  type GuestEventDetailRow,
  toGuestEventDetailDTO,
  encodeGuestEventsCursor,
  decodeGuestEventsCursor,
  clampGuestLimit,
} from '@/lib/dto-events'

// Guest browse reads the public_* views, which are omitted from the generated
// schema types; bind the PostgREST chain to this minimal structural type.
type LooseQuery = PromiseLike<{
  data: unknown
  error: { message: string } | null
}> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  gte: (column: string, value: unknown) => LooseQuery
  ilike: (column: string, value: unknown) => LooseQuery
  contains: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: unknown) => LooseQuery
  limit: (limit: number) => LooseQuery
  maybeSingle: () => LooseQuery
  or: (filter: string) => LooseQuery
}

interface GuestEventRow {
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
  attendee_count?: number | null
}

export interface GuestEventDTO {
  id: string
  title: string
  type: 'virtual' | 'irl'
  format: string
  locationOrLink: string | null
  startsAt: string
  durationMinutes: number
  capacity: number
  attendeeCount: number
  tags: string[]
}

export function toGuestEventDTO(row: GuestEventRow): GuestEventDTO {
  return {
    id: row.id,
    title: row.title,
    type: row.type === 'irl' ? 'irl' : 'virtual',
    format: row.format ?? 'social',
    locationOrLink: row.location_or_link ?? null,
    startsAt: row.starts_at ?? new Date(0).toISOString(),
    durationMinutes: row.duration_minutes ?? 60,
    capacity: row.capacity ?? 0,
    attendeeCount: row.attendee_count ?? 0,
    tags: row.tags ?? [],
  }
}

/**
 * Maps a guest client token to an analytics-only identity.
 *
 * CONTRACT (HOST-PRIV-03): this identity is for AGGREGATE telemetry ONLY
 * (funnel actors). Invalid or missing tokens collapse to "guest:unidentified",
 * so it is non-unique and non-authoritative — it MUST NOT be used for
 * rate-limiting, deduplication, entitlements, personalization, or any
 * security decision. Guard new call sites against that misuse.
 */
export function guestSessionId(clientToken?: string | null): string {
  if (clientToken && /^[a-zA-Z0-9_-]{16,64}$/.test(clientToken)) {
    return `guest:${clientToken}`
  }

  return 'guest:unidentified'
}

interface GuestIdeaRow {
  id: string
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  team_needed: string[]
  tags: string[]
  join_enabled: boolean
  validation_count: number
  image_url?: string | null
  created_at: string
}

export function toGuestIdeaDTO(row: GuestIdeaRow) {
  return {
    id: row.id,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    ask: row.ask,
    stage: row.stage,
    teamNeeded: row.team_needed ?? [],
    tags: row.tags ?? [],
    joinEnabled: Boolean(row.join_enabled),
    validationCount: row.validation_count ?? 0,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
  }
}

export interface GuestBrowseIdeasOptions {
  stage?: string
  tag?: string
  limit?: number
}

function normalizeLimit(value: number | undefined): number {
  return clampGuestLimit(value)
}

export async function getGuestIdeas(
  options: GuestBrowseIdeasOptions = {},
): Promise<{
  ideas: ReturnType<typeof toGuestIdeaDTO>[]
  hasMore: boolean
}> {
  const supabase = await createServerSupabaseClient()

  const limit = normalizeLimit(options.limit)

  let query = (
    supabase as unknown as {
      from: (table: 'public_ideas') => LooseQuery
    }
  )
    .from('public_ideas')
    .select(
      'id, title, problem, solution, ask, stage, team_needed, tags, join_enabled, validation_count, image_url, created_at',
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(limit + 1)

  if (options.stage) {
    query = query.eq('stage', options.stage)
  }

  if (options.tag) {
    query = query.contains('tags', [options.tag])
  }

  const { data, error } = await query

  if (error) {
    logger.warn('Guest idea browse failed', {
      error: error.message,
    })

    return {
      ideas: [],
      hasMore: false,
    }
  }

  const rows = (data ?? []) as unknown as GuestIdeaRow[]

  const hasMore = rows.length > limit

  return {
    ideas: rows.slice(0, limit).map(toGuestIdeaDTO),
    hasMore,
  }
}

export async function getGuestIdea(
  ideaId: string,
): Promise<ReturnType<typeof toGuestIdeaDTO> | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: 'public_ideas') => LooseQuery
    }
  )
    .from('public_ideas')
    .select(
      'id, title, problem, solution, ask, stage, team_needed, tags, join_enabled, validation_count, image_url, created_at',
    )
    .eq('id', ideaId)
    .maybeSingle()

  if (error) {
    logger.warn('Guest idea detail failed', {
      ideaId,
      error: error.message,
    })

    return null
  }

  if (!data) {
    return null
  }

  return toGuestIdeaDTO(data as GuestIdeaRow)
}

export interface GuestBrowseEventsOptions {
  upcoming?: boolean
  type?: string
  format?: string
  city?: string
  category?: string
  /** Opaque keyset cursor returned by a previous page's `nextCursor`. */
  cursor?: string
  limit?: number
}

export async function getGuestEvents(
  options: GuestBrowseEventsOptions = {},
): Promise<{
  events: GuestEventDTO[]
  hasMore: boolean
  nextCursor: string | null
}> {
  const supabase = await createServerSupabaseClient()

  const limit = normalizeLimit(options.limit)

  const cursor = decodeGuestEventsCursor(options.cursor)

  let query = (
    supabase as unknown as {
      from: (table: 'public_events') => LooseQuery
    }
  )
    .from('public_events')
    .select(
      'id, title, description, type, format, location_or_link, starts_at, duration_minutes, capacity, tags',
    )
    .order('starts_at', {
      ascending: true,
    })
    .order('id', {
      ascending: true,
    })
    .limit(limit + 1)

  if (options.upcoming) {
    query = query.gte('starts_at', new Date().toISOString())
  }

  if (options.type) {
    query = query.eq('type', options.type)
  }

  if (options.format) {
    query = query.eq('format', options.format)
  }

  if (options.category && options.category.trim()) {
    query = query.eq('category', options.category.trim())
  }

  if (options.city && options.city.trim()) {
    query = query
      .eq('type', 'irl')
      .ilike('location_or_link', `%${options.city.trim()}%`)
  }

  // Keyset pagination over the (starts_at, id) sort — strictly-forward, no
  // OFFSET drift. Combined with other filters the keyed pair is identical to
  // the ordered window, so pages stay consistent.
  if (cursor) {
    query = query.or(
      `and(starts_at.gt.${cursor.startsAt}),and(starts_at.eq.${cursor.startsAt},id.gt.${cursor.id})`,
    )
  }

  const { data, error } = await query

  if (error) {
    logger.warn('Guest event browse failed', {
      error: error.message,
    })

    return {
      events: [],
      hasMore: false,
      nextCursor: null,
    }
  }

  const rows = (data ?? []) as unknown as GuestEventRow[]

  const hasMore = rows.length > limit

  const page = rows.slice(0, limit)

  const last = page[limit - 1] ?? null

  return {
    events: page.map(toGuestEventDTO),
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeGuestEventsCursor(last.starts_at!, last.id)
        : null,
  }
}

export async function getGuestEvent(
  eventId: string,
): Promise<GuestEventDTO | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: 'public_events') => LooseQuery
    }
  )
    .from('public_events')
    .select(
      'id, title, description, type, format, location_or_link, starts_at, duration_minutes, capacity, tags',
    )
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    logger.warn('Guest event detail failed', {
      eventId,
      error: error.message,
    })

    return null
  }

  return data ? toGuestEventDTO(data as GuestEventRow) : null
}

/**
 * Aggregate availability for an event via the service-role client.
 *
 * CONTRACT: result is AGGREGATE ONLY (counts and booleans) — no attendee
 * identity ever leaves the server through this path. Every field is nullable
 * and the whole set degrades to all-null rather than throwing, so a guest can
 * never distinguish "event with no data" from "metrics unavailable".
 */
async function getEventRegistrationsCounts(
  eventId: string,
): Promise<GuestEventRegistrationCounts> {
  const admin = tryGetAdminSupabaseClient()

  if (!admin) {
    return EMPTY_GUEST_EVENT_COUNTS
  }

  try {
    const [eventRes, regsRes] = await Promise.all([
      admin
        .from('events')
        .select('capacity, registration_open')
        .eq('id', eventId)
        .maybeSingle(),
      admin
        .from('event_registrations')
        .select('status')
        .eq('event_id', eventId),
    ])

    const capacity = eventRes.data?.capacity ?? null
    const registrationOpen = eventRes.data?.registration_open ?? null

    const statuses = (regsRes.data ?? []).map((row) => row.status)

    const active = statuses.filter((s) =>
      ['registered', 'checked_in', 'no_show'].includes(s),
    ).length
    const waitlisted = statuses.filter((s) => s === 'waitlisted').length

    return {
      capacity: capacity ?? null,
      registeredCount: active,
      waitlistCount: waitlisted,
      spotsRemaining: capacity != null ? Math.max(capacity - active, 0) : null,
      isFull: capacity != null ? active >= capacity : null,
      registrationOpen: registrationOpen ?? null,
    }
  } catch (err) {
    logger.warn('Guest event counts unavailable', {
      eventId,
      error: err instanceof Error ? err.message : 'unknown',
    })

    return EMPTY_GUEST_EVENT_COUNTS
  }
}

export async function getGuestEventDetail(
  eventId: string,
): Promise<GuestEventDetailDTO | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: 'public_events') => LooseQuery
    }
  )
    .from('public_events')
    .select(
      'id, title, description, type, format, location_or_link, starts_at, duration_minutes, capacity, tags, cover_image, timezone, venue, price, currency, category',
    )
    .eq('id', eventId)
    .maybeSingle()

  if (error) {
    logger.warn('Guest event detail failed', {
      eventId,
      error: error.message,
    })

    return null
  }

  if (!data) {
    return null
  }

  const counts = await getEventRegistrationsCounts(eventId)

  return toGuestEventDetailDTO(data as GuestEventDetailRow, counts)
}

export async function trackGuestBrowseStarted(
  clientToken?: string | null,
  surface?: string,
): Promise<void> {
  await trackFunnel({
    eventName: FunnelEvents.GuestBrowseStarted,
    actorId: guestSessionId(clientToken),
    surface: surface ?? 'guest_browse',
    entityType: 'guest_session',
    result: 'started',
  })
}
