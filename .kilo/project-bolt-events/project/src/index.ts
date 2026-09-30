// src/features/events/index.ts
// Public surface of the events feature — analytics + organizer authorization.

export { createEventAnalyticsServices } from './factories/event-analytics.factory'
export { createEventOrganizerServices } from './factories/event-organizer.factory'

export { EventAnalyticsService } from './services/event-analytics.service'
export type { EventAnalyticsDashboard } from './dto/event-analytics.dto'
export type {
  EventRegistrationsByDayRow,
  EventViewsByDayRow,
  EventViewsBySourceRow,
} from './dto/event-analytics.dto'

export { EventOrganizerService } from './services/event-organizer.service'
export type { EventOrganizerPermissions } from './services/event-organizer.service'

export { resolveEventAnalytics } from './services/event-analytics-resolver'
