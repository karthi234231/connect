// src/services/events/attendees.service.ts
// Organizer-scoped attendee roster read (P0-06). Ownership is checked here (not
// only by RLS) so a non-organizer can never read another event's roster.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes } from '@/lib/errors'

export interface AttendeeRosterRow {
  name: string | null
  status: string
  registeredAt: string
  checkedInAt: string | null
  waitlistPosition: number | null
}

export async function getEventAttendeeRoster(
  eventId: string,
  organizerId: string,
): Promise<AttendeeRosterRow[]> {
  const supabase = await createServerSupabaseClient()

  const { data: owned } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizerId)
    .maybeSingle()

  if (!owned) {
    throw AppError.forbidden('You can only export your own event rosters.')
  }

  const { data, error } = await supabase
    .from('event_registrations')
    .select(
      'status, registered_at, checked_in_at, waitlist_position, profiles(full_name)',
    )
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .order('registered_at', { ascending: true })

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load attendee roster', {
      cause: error,
    })
  }

  return (data ?? []).map((row) => {
    const profile = row.profiles as { full_name?: string | null } | null
    return {
      name: profile?.full_name ?? null,
      status: row.status,
      registeredAt: row.registered_at,
      checkedInAt: row.checked_in_at,
      waitlistPosition: row.waitlist_position,
    }
  })
}
