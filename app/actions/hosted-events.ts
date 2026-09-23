// src/app/actions/hosted-events.ts
// Hosted-events read boundary: events where caller is organizer.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes, toErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { invalidateUserCache } from '@/lib/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uuidSchema } from '@/lib/validation'
import type { Database } from '@/types/database'
import type { EventCardData } from '@/types/event'

const hostedEventRowSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  starts_at: z.string(),
  timezone: z.string().nullable().optional(),
  location_or_link: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  cover_image: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  organizer_id: uuidSchema,
})

const eventIdSchema = z.object({ eventId: uuidSchema }).strict()

export interface EventAttendee {
  id: string
  status: string
  registeredAt: string
  checkedInAt: string | null
  waitlistPosition: number | null
  name: string | null
  avatarUrl: string | null
}

const attendeeRowSchema = z.object({
  id: uuidSchema,
  status: z.string(),
  registered_at: z.string(),
  checked_in_at: z.string().nullable(),
  waitlist_position: z.number().int().nullable(),
  profiles: z
    .object({
      full_name: z.string().nullable().optional(),
      avatar_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

export async function getEventAttendeesAction(input: {
  eventId: string
}): Promise<EventAttendee[]> {
  const userId = await requireUser()
  const parsed = eventIdSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That event is not valid.')
  }

  const supabase = await createServerSupabaseClient()

  // Organization boundary is enforced here (not just by RLS) so a non-organizer
  // can never see even their own single row in someone else's roster.
  const { data: owned } = await supabase
    .from('events')
    .select('id')
    .eq('id', parsed.data.eventId)
    .eq('organizer_id', userId)
    .maybeSingle()
  if (!owned) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'That event was not found.')
  }

  const { data, error } = await supabase
    .from('event_registrations')
    .select(
      'id, user_id, status, registered_at, checked_in_at, waitlist_position, profiles(full_name, avatar_url)',
    )
    .eq('event_id', parsed.data.eventId)
    .neq('status', 'cancelled')
    .order('registered_at', { ascending: true })
  if (error) throw error

  const rows = attendeeRowSchema.array().parse(data ?? [])

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    registeredAt: row.registered_at,
    checkedInAt: row.checked_in_at,
    waitlistPosition: row.waitlist_position,
    // profiles RLS may hide private profiles from the organizer's join;
    // the UI falls back to a generic label in that case.
    name: row.profiles?.full_name ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
  }))
}

export async function setEventAttendeeCheckedInAction(input: {
  registrationId: string
  eventId: string
  checked: boolean
}): Promise<{ id: string; checkedInAt: string | null }> {
  const parsed = z
    .object({
      registrationId: uuidSchema,
      eventId: uuidSchema,
      checked: z.boolean(),
    })
    .strict()
    .safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That registration is not valid.')
  }

  await requireUser()

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('event_registrations')
    .update({
      checked_in_at: parsed.data.checked ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.registrationId)
    .eq('event_id', parsed.data.eventId)
    .select('id, checked_in_at')
    .maybeSingle()

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Unable to update check-in.')
  }
  if (!data) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'That registration was not found.')
  }

  return { id: data.id, checkedInAt: data.checked_in_at }
}

export async function getHostedEventsAction(): Promise<EventCardData[]> {
  const userId = await requireUser()
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('events')
    .select(
      'id,title,starts_at,timezone,location_or_link,format,type,category,capacity,price,cover_image,organizer_id',
    )
    .eq('organizer_id', userId)
    .order('starts_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return hostedEventRowSchema
    .array()
    .parse(data ?? []) as unknown as EventCardData[]
}

export async function getHostedEventAction(input: {
  eventId: string
}): Promise<EventCardData> {
  const userId = await requireUser()
  const parsed = eventIdSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That event is not valid.')
  }
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('events')
    .select(
      'id,title,starts_at,timezone,location_or_link,format,type,category,capacity,price,cover_image,description,organizer_id',
    )
    .eq('id', parsed.data.eventId)
    .eq('organizer_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'That event was not found.')
  }
  return hostedEventRowSchema.parse(data) as unknown as EventCardData
}

/**
 * Full editable projection for the event edit form: adds `description` and
 * `capacity`, which the card projection (`EventCardData`) does not carry.
 * Organizer-scoped — a non-owner gets NOT_FOUND.
 */
export interface EditableEvent {
  id: string
  title: string
  description: string | null
  startsAt: string
  locationOrLink: string | null
  capacity: number
}

export async function getEditableEventAction(input: {
  eventId: string
}): Promise<EditableEvent> {
  const userId = await requireUser()
  const parsed = eventIdSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That event is not valid.')
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,starts_at,location_or_link,capacity')
    .eq('id', parsed.data.eventId)
    .eq('organizer_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'That event was not found.')
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description ?? null,
    startsAt: data.starts_at,
    locationOrLink: data.location_or_link ?? null,
    capacity: data.capacity,
  }
}

// ─── Organizer writes (P0-04 create, P0-05 update) ──────────────────────────

const eventFormatSchema = z.enum([
  'build_night',
  'coffee',
  'challenge',
  'office_hours',
  'workshop',
  'social',
])

const createEventSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    startsAt: z.string().datetime(),
    timezone: z.string().trim().min(1).max(64).optional(),
    locationOrLink: z.string().trim().max(300).nullable().optional(),
    format: eventFormatSchema.optional(),
    type: z.enum(['virtual', 'irl']).optional(),
    capacity: z.number().int().min(1).max(100000).optional(),
    category: z.string().trim().max(40).optional(),
  })
  .strict()

export interface EventWriteResult {
  ok: boolean
  error: string | null
  eventId: string | null
}

function writeFailure(scope: string, error: unknown): EventWriteResult {
  logger.error(`Hosted event write failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message, eventId: null }
}

/**
 * Create an event owned by the caller. `organizer_id` is taken from the verified
 * session — never the payload — so a caller can only create their own event.
 */
export async function createHostedEventAction(input: {
  title: string
  description?: string | null
  startsAt: string
  timezone?: string
  locationOrLink?: string | null
  format?: string
  type?: 'virtual' | 'irl'
  capacity?: number
  category?: string
}): Promise<EventWriteResult> {
  const userId = await requireUser()

  const parsed = createEventSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: toErrorPayload(parsed.error).message,
      eventId: null,
    }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('events')
      .insert({
        organizer_id: userId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        starts_at: parsed.data.startsAt,
        timezone: parsed.data.timezone ?? 'UTC',
        location_or_link: parsed.data.locationOrLink ?? 'Online',
        format: parsed.data.format ?? 'social',
        type: parsed.data.type ?? 'virtual',
        capacity: parsed.data.capacity ?? 50,
        category: parsed.data.category ?? 'general',
        status: 'published',
        visibility: 'public',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) return writeFailure('create', error)

    invalidateUserCache(userId)
    return { ok: true, error: null, eventId: data.id }
  } catch (error) {
    return writeFailure('create', error)
  }
}

const updateEventSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    locationOrLink: z.string().trim().max(300).nullable().optional(),
    capacity: z.number().int().min(1).max(100000).optional(),
  })
  .strict()

/**
 * Update an event the caller organizes. Ownership is enforced by the
 * organizer_id predicate on the UPDATE, so a non-owner matches zero rows and
 * gets NOT_FOUND rather than a silent no-op.
 */
export async function updateHostedEventAction(input: {
  eventId: string
  title?: string
  description?: string | null
  startsAt?: string
  locationOrLink?: string | null
  capacity?: number
}): Promise<EventWriteResult> {
  const userId = await requireUser()

  const idParsed = eventIdSchema.safeParse({ eventId: input.eventId })
  const parsed = updateEventSchema.safeParse({
    title: input.title,
    description: input.description,
    startsAt: input.startsAt,
    locationOrLink: input.locationOrLink,
    capacity: input.capacity,
  })

  if (!idParsed.success || !parsed.success) {
    return {
      ok: false,
      error: toErrorPayload(parsed.success ? null : parsed.error).message,
      eventId: null,
    }
  }

  const patch: Database['public']['Tables']['events']['Update'] = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined)
    patch.description = parsed.data.description
  if (parsed.data.startsAt !== undefined) patch.starts_at = parsed.data.startsAt
  if (parsed.data.locationOrLink !== undefined)
    // location_or_link is NOT NULL on the table; a cleared value falls back to
    // the same 'Online' default the create path uses.
    patch.location_or_link = parsed.data.locationOrLink ?? 'Online'
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('events')
      .update(patch)
      .eq('id', idParsed.data.eventId)
      .eq('organizer_id', userId)
      .select('id')
      .maybeSingle()

    if (error) return writeFailure('update', error)
    if (!data) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'That event was not found.')
    }

    invalidateUserCache(userId)
    return { ok: true, error: null, eventId: data.id }
  } catch (error) {
    return writeFailure('update', error)
  }
}
