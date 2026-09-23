// src/lib/analytics/event-views.ts
// S41 — event view telemetry (pure observability).
//
// Records an event detail view through the existing funnel pipeline. Views are
// appendix-only telemetry that flows Redis → analytics_events (flush job) and are
// aggregated for the analytics dashboard. They MUST never influence a domain
// decision (capacity, registration, eligibility) — trackEventView is best-effort
// and never throws, so observability can't break a request path.
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'

export interface TrackEventViewInput {
  eventId: string
  actorId?: string
  surface?: string
}

/** Best-effort event view telemetry. Never throws. */
export async function trackEventView(
  input: TrackEventViewInput,
): Promise<void> {
  await trackFunnel({
    eventName: FunnelEvents.EventViewed,
    actorId: input.actorId,
    surface: input.surface ?? 'events',
    entityType: 'event',
    entityId: input.eventId,
  })
}
