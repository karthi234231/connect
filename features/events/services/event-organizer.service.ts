// src/features/events/services/event-organizer.service.ts
// Organizer authorization for event analytics/edit surfaces.
//
// Source of truth: `events.organizer_id` (canonical column, renamed from the
// legacy `host_id` in S019). The codebase has no co-organizer table — the
// RLS policies, `register_event` and the `event_registration_analytics` RPC
// all gate on `organizer_id = auth.uid()` — so organizer authorship is the
// single authority used here.

import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export interface EventOrganizerPermissions {
  canViewAnalytics: boolean
  canEdit: boolean
}

type AdminClient = ReturnType<typeof getAdminSupabaseClient>

export class EventOrganizerService {
  constructor(private readonly supabase: AdminClient) {}

  /**
   * Resolve the caller's permissions for a single event. Uses the service-role
   * client (RLS-bypassing) because a caller may not yet be proven to be the
   * organizer — proof is exactly this check. A missing event is treated as
   * "no permissions" (false/false) so the route can respond 403; genuine DB
   * failures throw.
   */
  async getPermissions(
    eventId: string,
    userId: string,
  ): Promise<EventOrganizerPermissions> {
    const { data, error } = await this.supabase
      .from('events')
      .select('id, organizer_id')
      .eq('id', eventId)
      .maybeSingle()

    if (error) {
      logger.error('getPermissions: event lookup failed', {
        eventId,
        userId,
        error: error.message,
      })

      throw new AppError(
        ErrorCodes.INTERNAL,
        'Failed to load event organizer',
        {
          cause: error,
        },
      )
    }

    if (!data) {
      return { canViewAnalytics: false, canEdit: false }
    }

    const isOrganizer = data.organizer_id === userId

    return {
      canViewAnalytics: isOrganizer,
      canEdit: isOrganizer,
    }
  }
}
