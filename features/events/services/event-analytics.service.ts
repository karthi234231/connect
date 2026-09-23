// src/features/events/services/event-analytics.service.ts
// Builds the event analytics dashboard from:
//   - analytics_events   → page views (event_name = 'event_viewed',
//                          entity_type = 'event', entity_id = eventId)
//   - event_registrations→ registration/status counts + daily timeline
//   - events             → capacity/title (and the event's timezone for
//                          calendar-day bucketing, mirroring the
//                          event_registration_analytics RPC in S019/S022)
//
// The `analytics_events` / `analytics_daily` tables are admin-read-only under
// RLS, so this service uses the service-role client (RLS-bypassing), matching
// admin/service.ts and alerts.service.ts.

import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { FunnelEvents } from '@/lib/analytics/funnel'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type {
  EventAnalyticsDashboard,
  EventRegistrationsByDayRow,
  EventViewsByDayRow,
  EventViewsBySourceRow,
} from '../dto/event-analytics.dto'

type AdminClient = ReturnType<typeof getAdminSupabaseClient>

/** Statuses that count toward "registered" (matches register_event capacity). */
const REGISTERED_STATUSES = new Set(['registered', 'checked_in', 'no_show'])
const CANCELLED_STATUS = 'cancelled'
const WAITLISTED_STATUS = 'waitlisted'
const NO_SHOW_STATUS = 'no_show'

export class EventAnalyticsService {
  constructor(private readonly supabase: AdminClient) {}

  /**
   * Build the analytics dashboard for an event. Never throws on missing data:
   * a non-existent event (or empty telemetry) yields a zeroed dashboard with
   * empty arrays. DB/fetch failures still throw (wrapped + logged) — the
   * caller's try/catch maps those to 500.
   */
  async getEventAnalytics(
    eventId: string,
    _userId: string,
  ): Promise<EventAnalyticsDashboard> {
    const eventPromise = this.supabase
      .from('events')
      .select('id, title, capacity, timezone')
      .eq('id', eventId)
      .maybeSingle()

    const registrationsPromise = this.supabase
      .from('event_registrations')
      .select('status, registered_at, checked_in_at')
      .eq('event_id', eventId)

    const viewsPromise = this.supabase
      .from('analytics_events')
      .select('id, actor_id, created_at, surface')
      .eq('event_name', FunnelEvents.EventViewed)
      .eq('entity_type', 'event')
      .eq('entity_id', eventId)

    const [eventResult, registrationsResult, viewsResult] = await Promise.all([
      eventPromise,
      registrationsPromise,
      viewsPromise,
    ])

    if (eventResult.error) {
      logger.error('getEventAnalytics: event lookup failed', {
        eventId,
        error: eventResult.error.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load event', {
        cause: eventResult.error,
      })
    }

    if (registrationsResult.error) {
      logger.error('getEventAnalytics: registrations lookup failed', {
        eventId,
        error: registrationsResult.error.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load registrations', {
        cause: registrationsResult.error,
      })
    }

    if (viewsResult.error) {
      logger.error('getEventAnalytics: views lookup failed', {
        eventId,
        error: viewsResult.error.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load event views', {
        cause: viewsResult.error,
      })
    }

    const event = eventResult.data
    const timezone = event ? event.timezone || 'UTC' : 'UTC'

    const regRow = registrationsResult.data ?? []

    let registrations = 0
    let cancellations = 0
    let waitlistCount = 0
    let checkedInCount = 0
    let noShowCount = 0

    const registrationsByDayMap = new Map<string, number>()

    for (const row of regRow) {
      if (row.status === CANCELLED_STATUS) {
        cancellations += 1
      } else if (row.status === WAITLISTED_STATUS) {
        waitlistCount += 1
      } else if (row.status === NO_SHOW_STATUS) {
        noShowCount += 1
      }

      if (row.checked_in_at) {
        checkedInCount += 1
      }

      if (REGISTERED_STATUSES.has(row.status)) {
        registrations += 1
        const day = toCalendarDay(row.registered_at, timezone)

        if (day) {
          registrationsByDayMap.set(
            day,
            (registrationsByDayMap.get(day) ?? 0) + 1,
          )
        }
      }
    }

    const viewRows = viewsResult.data ?? []

    let views = 0
    const uniqueActors = new Set<string>()
    const viewsByDayMap = new Map<string, number>()
    const sourcesMap = new Map<string, { views: number; unique: Set<string> }>()

    for (const row of viewRows) {
      views += 1

      if (row.actor_id) {
        uniqueActors.add(row.actor_id)
      }

      const day = toCalendarDay(row.created_at, timezone)

      if (day) {
        viewsByDayMap.set(day, (viewsByDayMap.get(day) ?? 0) + 1)
      }

      const source = row.surface && row.surface.trim() ? row.surface : 'unknown'
      let entry = sourcesMap.get(source)

      if (!entry) {
        entry = { views: 0, unique: new Set<string>() }
        sourcesMap.set(source, entry)
      }

      entry.views += 1

      if (row.actor_id) {
        entry.unique.add(row.actor_id)
      }
    }

    const uniqueViews = uniqueActors.size

    const viewsByDay: EventViewsByDayRow[] = [...viewsByDayMap.entries()]
      .map(([date, count]) => ({ date, views: count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const registrationsByDay: EventRegistrationsByDayRow[] = [
      ...registrationsByDayMap.entries(),
    ]
      .map(([date, count]) => ({ date, registrations: count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const viewsBySource: EventViewsBySourceRow[] = [...sourcesMap.entries()]
      .map(([source, s]) => ({
        source,
        views: s.views,
        uniqueViews: s.unique.size,
      }))
      .sort((a, b) => b.views - a.views)

    return {
      eventId,
      eventTitle: event ? event.title : '',
      capacity: event ? (event.capacity ?? 0) : 0,
      views,
      uniqueViews,
      registrations,
      cancellations,
      waitlistCount,
      checkedInCount,
      noShowCount,
      conversionRate: views > 0 ? registrations / views : 0,
      viewsByDay,
      registrationsByDay,
      viewsBySource,
    }
  }
}

/**
 * Format a timestamp as `YYYY-MM-DD` in the event's calendar timezone
 * (falls back to UTC day for empty/invalid timezones or bad timestamps).
 * Mirrors the `to_char(registered_at at time zone v_tz, 'YYYY-MM-DD')`
 * bucketing used by the event_registration_analytics RPC.
 */
function toCalendarDay(isoDate: string, timezone: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC'

  try {
    return date.toLocaleDateString('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
