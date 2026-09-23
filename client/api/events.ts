import { ROUTES, eventAnalyticsExportPath } from '@/config/routes'
import { apiFetch, buildQuery } from '@/client/api/http'

export interface EventAnalyticsParams {
  from: string
  to: string
  timezone: string
}

export interface EventAnalytics {
  eventId: string
  views: number
  uniqueViews: number
  registrations: number
  cancellations: number
  waitlistCount: number
  checkedInCount: number
  conversionRate: number
  viewsByDay: Array<{ date: string; views: number }>
  registrationsByDay: Array<{ date: string; registrations: number }>
  /** Breakdown of views by entry surface — mirrors EventAnalyticsDashboard. */
  viewsBySource: Array<{
    source: string
    views: number
    uniqueViews: number
  }>
}

export async function fetchEventAnalytics(
  eventId: string,
  params: EventAnalyticsParams,
): Promise<EventAnalytics> {
  const url = `${ROUTES.api.eventsAnalytics}${buildQuery({
    eventId,
    from: params.from,
    to: params.to,
    timezone: params.timezone,
  })}`

  const response = await apiFetch<{ data: EventAnalytics }>(url)
  return response.data
}

export async function fetchEventAnalyticsExportJson(
  eventId: string,
): Promise<EventAnalytics> {
  const url = `${eventAnalyticsExportPath(eventId)}${buildQuery({
    format: 'json',
  })}`

  return apiFetch<EventAnalytics>(url, { cache: 'no-store' })
}

export async function fetchEventAnalyticsExportCsv(
  eventId: string,
): Promise<string> {
  const url = `${eventAnalyticsExportPath(eventId)}${buildQuery({
    format: 'csv',
  })}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Analytics export failed with status ${response.status}`)
  }
  return response.text()
}

// ─── Guest public events feed (WS-A2) ───────────────────────────────────────

export interface PublicEventCard {
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
  category?: string | null
}

export interface PublicEventsPage {
  events: PublicEventCard[]
  hasMore: boolean
  nextCursor: string | null
}

export interface PublicEventFilters {
  limit?: number
  cursor?: string
  category?: string
  type?: 'virtual' | 'irl'
  city?: string
  upcoming?: boolean
}

export async function fetchPublicEvents(
  filters: PublicEventFilters = {},
): Promise<PublicEventsPage> {
  const url = `${ROUTES.api.browse}${buildQuery({
    limit: filters.limit ?? 20,
    cursor: filters.cursor,
    category: filters.category,
    type: filters.type,
    city: filters.city,
    upcoming: filters.upcoming ?? true,
  })}`

  const response = await apiFetch<{
    data: {
      ideas: unknown[]
      events: PublicEventCard[]
      nextCursor: string | null
      hasMore: boolean
    }
  }>(url)

  return {
    events: response.data.events ?? [],
    hasMore: response.data.hasMore ?? false,
    nextCursor: response.data.nextCursor ?? null,
  }
}

export interface GuestEventDetail {
  id: string
  title: string
  description: string | null
  type: 'virtual' | 'irl'
  format: string
  locationOrLink: string | null
  startsAt: string
  durationMinutes: number
  capacity: number
  tags: string[]
  coverImage: string | null
  timezone: string | null
  venue: Record<string, unknown> | null
  price: number
  currency: string | null
  category: string | null
  registeredCount: number | null
  waitlistCount: number | null
  spotsRemaining: number | null
  isFull: boolean | null
  registrationOpen: boolean | null
  organizerName?: string | null
  organizerAvatarUrl?: string | null
}

export async function fetchGuestEvent(
  eventId: string,
): Promise<GuestEventDetail> {
  const url = `${ROUTES.api.browse}${buildQuery({ eventId })}`

  const response = await apiFetch<{ data: { event: GuestEventDetail } }>(url)
  return response.data.event
}

/** Trigger a browser-side file download from an in-memory string payload. */
export function downloadTextFile(
  filename: string,
  content: string,
  contentType: string,
): void {
  if (typeof document === 'undefined') return

  const url = URL.createObjectURL(new Blob([content], { type: contentType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function exportEventAnalyticsJson(eventId: string): Promise<void> {
  const data = await fetchEventAnalyticsExportJson(eventId)
  downloadTextFile(
    `event-${eventId}-analytics.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  )
}

export async function exportEventAnalyticsCsv(eventId: string): Promise<void> {
  const csv = await fetchEventAnalyticsExportCsv(eventId)
  downloadTextFile(`event-${eventId}-analytics.csv`, csv, 'text/csv')
}
