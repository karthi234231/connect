// src/lib/calendar.ts
// ─────────────────────────────────────────────────────────────────────────────
// W3.8 / W4.9 — add-to-calendar support (Meetup/AllEvents pattern §7.11).
// Generates a standards-compliant .ics payload and a Google Calendar "add"
// deep link. All functions are PURE and unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarEventInput {
  id: string
  title: string
  description?: string | null
  /** Virtual → meeting/join link; IRL → venue string. */
  location?: string | null
  /** ISO 8601 timestamp for the start. */
  startsAt: string
  durationMinutes: number
}

/** Escape a value for use inside an .ics text field (RFC 5545). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Format a Date (or ISO string) into UTC `YYYYMMDDTHHMMSSZ` for .ics (DTSTART). */
export function toIcsUtc(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Build a full .ics calendar payload (single VEVENT). */
export function generateEventIcs(event: CalendarEventInput): string {
  const start = new Date(event.startsAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Connect//Collaborator Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@connect`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  // RFC 5545 requires CRLF line endings.
  return lines.join('\r\n') + '\r\n'
}

/** Build a Google Calendar "add to calendar" URL for an event. */
export function getGoogleCalendarUrl(event: CalendarEventInput): string {
  const start = new Date(event.startsAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toIcsUtc(start)}/${toIcsUtc(end)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
