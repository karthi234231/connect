// src/features/events/dto/event-analytics.dto.ts
// Event analytics dashboard DTO (pure, no I/O) — mirrors lib/dto-events.ts
// conventions. Consumed by:
//   - app/api/events/analytics/route.ts            (GET → { data: dashboard })
//   - app/api/events/[eventId]/analytics/export/route.ts (CSV/JSON builder)
// The export route serializes `viewsByDay`/`registrationsByDay` straight into
// its CSV; those field names/types are part of the wire contract.

/** A single day of event page views: `YYYY-MM-DD` + view count. */
export interface EventViewsByDayRow {
  date: string
  views: number
}

/** A single day of registrations: `YYYY-MM-DD` + registration count. */
export interface EventRegistrationsByDayRow {
  date: string
  registrations: number
}

/** Breakdown of event views by entry surface (e.g. `events`, `search`, `feed`). */
export interface EventViewsBySourceRow {
  source: string
  views: number
  uniqueViews: number
}

/**
 * Event analytics dashboard — the single object returned by
 * `EventAnalyticsService.getEventAnalytics`. The export route's CSV builder
 * consumes `eventId`, `views`, `uniqueViews`, `registrations`, `cancellations`,
 * `waitlistCount`, `checkedInCount`, `conversionRate`, `viewsByDay` and
 * `registrationsByDay`; the JSON exporter serializes the whole object plus the
 * extra context fields below.
 */
export interface EventAnalyticsDashboard {
  eventId: string
  eventTitle: string
  capacity: number

  /** Total distinct event-view telemetry rows (`analytics_events`). */
  views: number
  /** Distinct authenticated/guest actor ids among views. */
  uniqueViews: number

  /** Conviction: statuses `registered` + `checked_in` + `no_show`. */
  registrations: number
  cancellations: number
  waitlistCount: number
  /** Rows with a non-null `checked_in_at`. */
  checkedInCount: number
  noShowCount: number

  /** registrations / views (0..1); 0 when there are no views. */
  conversionRate: number

  viewsByDay: EventViewsByDayRow[]
  registrationsByDay: EventRegistrationsByDayRow[]
  viewsBySource: EventViewsBySourceRow[]
}
