// src/features/events/services/event-analytics-resolver.ts
// Shared auth + permission + fetch for the two events analytics API routes:
//   - GET /api/events/analytics            (JSON dashboard)
//   - GET /api/events/[eventId]/analytics/export  (CSV / JSON blob)
// Both follow the same "organizer-only" gate: check permissions, then fetch.
// Throwing AppError(FORBIDDEN) lets the route map it to 403 without
// duplicating the service wiring.
import { AppError, ErrorCodes } from '@/lib/errors'
import { createEventOrganizerServices } from '@/features/events/factories/event-organizer.factory'
import { createEventAnalyticsServices } from '@/features/events/factories/event-analytics.factory'
import type { EventAnalyticsDashboard } from '@/features/events/dto/event-analytics.dto'

export async function resolveEventAnalytics(
  eventId: string,
  userId: string,
): Promise<EventAnalyticsDashboard> {
  const { service: organizerService } = await createEventOrganizerServices()
  const permissions = await organizerService.getPermissions(eventId, userId)

  if (!permissions.canViewAnalytics) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Access denied')
  }

  const { service: analyticsService } = await createEventAnalyticsServices()
  return analyticsService.getEventAnalytics(eventId, userId)
}
