// lib/calendar.test.ts
import { describe, it, expect } from 'vitest'

import {
  escapeIcsText,
  generateEventIcs,
  getGoogleCalendarUrl,
  toIcsUtc,
  type CalendarEventInput,
} from '@/lib/calendar'

const input: CalendarEventInput = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Build Night',
  description: 'Bring your side project.',
  location: 'Berlin Tech Hub',
  startsAt: '2026-09-21T10:00:00.000Z',
  durationMinutes: 90,
}

describe('toIcsUtc', () => {
  it('formats as UTC YYYYMMDDTHHMMSSZ', () => {
    expect(toIcsUtc('2026-09-21T10:05:30.000Z')).toBe('20260921T100530Z')
  })

  it('accepts a Date object', () => {
    expect(toIcsUtc(new Date('2026-01-02T03:04:05.000Z'))).toBe(
      '20260102T030405Z',
    )
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash, semicolons and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })
})

describe('generateEventIcs', () => {
  it('builds a single VEVENT with CRLF line endings', () => {
    const ics = generateEventIcs(input)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT\r\n')
    expect(ics).toContain(`UID:${input.id}@connect\r\n`)
    expect(ics).toContain('DTSTART:20260921T100000Z\r\n')
    expect(ics).toContain('DTEND:20260921T113000Z\r\n')
    expect(ics).toContain('SUMMARY:Build Night\r\n')
    expect(ics).toContain('DESCRIPTION:Bring your side project.\r\n')
    expect(ics).toContain('LOCATION:Berlin Tech Hub\r\n')
    expect(ics).toContain('END:VEVENT\r\n')
    expect(ics).toContain('END:VCALENDAR\r\n')
  })

  it('omits optional fields when absent', () => {
    const ics = generateEventIcs({
      id: 'e1',
      title: 'Coffee',
      startsAt: input.startsAt,
      durationMinutes: 30,
    })
    expect(ics).not.toContain('DESCRIPTION:')
    expect(ics).not.toContain('LOCATION:')
  })
})

describe('getGoogleCalendarUrl', () => {
  it('builds a TEMPLATE URL with encoded text, dates and location', () => {
    const params = new URL(getGoogleCalendarUrl(input)).searchParams
    expect(params.get('action')).toBe('TEMPLATE')
    expect(params.get('dates')).toBe('20260921T100000Z/20260921T113000Z')
    expect(params.get('text')).toBe('Build Night')
    expect(params.get('location')).toBe('Berlin Tech Hub')
    expect(params.get('details')).toBe('Bring your side project.')
  })
})
