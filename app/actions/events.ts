// src/app/actions/events.ts
// Public event RSVP + registration status (WS-A2). Registration is delegated
// to the canonical `register_event_full` RPC, which is one atomic round trip:
// identity check, duplicate detection, capacity/waitlist decision, insert and
// idempotency persistence happen inside a single Postgres transaction.
'use server'

import { randomUUID } from 'crypto'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uuidSchema } from '@/lib/validation'

const eventIdSchema = z.object({ eventId: uuidSchema }).strict()

const registerEventResultSchema = z.object({
  registration: z.object({
    id: z.string().uuid(),
    event_id: z.string().uuid(),
    user_id: z.string().uuid(),
    status: z.string(),
    registered_at: z.string(),
    cancelled_at: z.string().nullable(),
    checked_in_at: z.string().nullable(),
    waitlist_position: z.number().int().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  outcome: z.enum([
    'registered',
    'waitlisted',
    'already_registered',
    'already_waitlisted',
  ]),
  waitlist_position: z.number().int().nullable(),
  registered_count: z.number().int(),
  waitlisted_count: z.number().int(),
  capacity: z.number().int().nullable(),
  remaining_capacity: z.number().int().nullable(),
  spots_remaining: z.number().int().nullable(),
  is_full: z.boolean(),
  promoted_registration_id: z.string().uuid().nullable(),
})

export type RegistrationStatus =
  'registered' | 'waitlisted' | 'cancelled' | 'checked_in' | 'no_show'

export interface RegisterForEventResult {
  outcome:
    'registered' | 'waitlisted' | 'already_registered' | 'already_waitlisted'
  status: string
  waitlistPosition: number | null
  registeredCount: number
  waitlistedCount: number
  capacity: number | null
  spotsRemaining: number | null
  isFull: boolean
}

/** Map canonical RPC raises to wire-safe AppErrors (provider text never leaks). */
function mapRegistrationRpcError(message?: string): AppError {
  switch (message) {
    case 'UNAUTHENTICATED':
      return AppError.unauthenticated(
        'Please sign in to register for this event.',
      )
    case 'FORBIDDEN':
      return AppError.forbidden('You can only register on your own behalf.')
    case 'EVENT_NOT_FOUND':
      return AppError.notFound('event')
    case 'REGISTRATION_CLOSED':
      return AppError.conflict('Registration for this event is closed.')
    case 'IDEMPOTENCY_CONFLICT':
      return AppError.conflict(
        'That request was already used to register. Please try again.',
      )
    default:
      return new AppError(
        ErrorCodes.INTERNAL,
        'Failed to register for the event.',
        { cause: message },
      )
  }
}

export async function registerForEventAction(input: {
  eventId: string
}): Promise<RegisterForEventResult> {
  const parsed = eventIdSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That event is not valid.')
  }

  const userId = await requireUser()
  // Idempotency key: one request id per (user, event, operation) so double
  // clicks can never create duplicate registrations.
  const requestId = randomUUID()

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('register_event_full', {
    p_event_id: parsed.data.eventId,
    p_user_id: userId,
    p_request_id: requestId,
  })

  if (error) {
    throw mapRegistrationRpcError(error.message)
  }

  const result = registerEventResultSchema.safeParse(data)
  if (!result.success) {
    logger.error('register_event_full returned an unexpected shape', {
      eventId: parsed.data.eventId,
      userId,
      parseError: result.error.flatten(),
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to register for the event.')
  }

  return {
    outcome: result.data.outcome,
    status: result.data.registration.status,
    waitlistPosition: result.data.registration.waitlist_position,
    registeredCount: result.data.registered_count,
    waitlistedCount: result.data.waitlisted_count,
    capacity: result.data.capacity,
    spotsRemaining: result.data.spots_remaining,
    isFull: result.data.is_full,
  }
}

export interface GuestRegistrationStatus {
  status: RegistrationStatus
  waitlistPosition: number | null
}

/**
 * Current registration state for the signed-in user on an event. Throws
 * AppError(UNAUTHENTICATED) for guests — the page uses that to show the
 * "sign in to register" path instead of an RSVP button.
 *
 * Returns null when the user has no row for this event.
 */
export async function getGuestRegistrationStatusAction(input: {
  eventId: string
}): Promise<GuestRegistrationStatus | null> {
  const parsed = eventIdSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That event is not valid.')
  }

  const userId = await requireUser()

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('event_registrations')
    .select('status, waitlist_position')
    .eq('event_id', parsed.data.eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Unable to load your registration.')
  }

  if (!data) {
    return null
  }

  return {
    status: data.status as GuestRegistrationStatus['status'],
    waitlistPosition: data.waitlist_position,
  }
}

export {
  createHostedEventAction,
  createHostedEventAction as createEventAction,
} from './hosted-events'

