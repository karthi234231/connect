// src/app/api/events/[eventId]/attendees/export/route.ts
// Organizer-only attendee roster export (P0-06). This is a ROSTER export, not
// the analytics export the UI previously (incorrectly) called. Ownership is
// enforced server-side: a non-organizer gets 403/404, never another event's
// roster. CSV cell values are escaped to neutralise spreadsheet formula
// injection (=, +, -, @ leading characters).

import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes, apiError } from '@/lib/errors'
import { getEventAttendeeRoster } from '@/services/events/attendees.service'

/** Neutralise CSV formula injection and quote/escape the field. */
function csvCell(value: string | null | undefined): string {
  const raw = value ?? ''
  const needsGuard = /^[=+\-@\t\r]/.test(raw)
  const guarded = needsGuard ? `'${raw}` : raw
  return `"${guarded.replace(/"/g, '""')}"`
}

function buildCsv(
  rows: Array<{
    name: string | null
    status: string
    registeredAt: string
    checkedInAt: string | null
    waitlistPosition: number | null
  }>,
): string {
  const lines: string[] = []
  lines.push(
    ['Name', 'Status', 'Registered at', 'Checked in at', 'Waitlist position']
      .map(csvCell)
      .join(','),
  )
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.name ?? 'Attendee'),
        csvCell(row.status),
        csvCell(row.registeredAt),
        csvCell(row.checkedInAt ?? ''),
        csvCell(
          row.waitlistPosition != null ? String(row.waitlistPosition) : '',
        ),
      ].join(','),
    )
  }
  return lines.join('\n')
}

async function handleGet(
  session: import('@/lib/auth').CurrentSession,
  _request: Request,
  ctx?: { params: Promise<{ eventId: string }> },
) {
  const eventId = (await ctx?.params)?.eventId

  if (!eventId) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Missing eventId.'),
      { status: 400 },
    )
  }

  try {
    const rows = await getEventAttendeeRoster(eventId, session.userId)
    const csv = buildCsv(rows)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${eventId}-attendees.csv"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (error) {
    if (
      AppError.isAppError(error) &&
      (error.code === ErrorCodes.FORBIDDEN ||
        error.code === ErrorCodes.NOT_FOUND)
    ) {
      return NextResponse.json(apiError(error.code, 'Not found.'), {
        status: error.code === ErrorCodes.FORBIDDEN ? 403 : 404,
      })
    }
    logger.error('Attendee export API failed', { eventId, error })
    return NextResponse.json(
      apiError(ErrorCodes.INTERNAL, 'Unable to export attendees.'),
      { status: 500 },
    )
  }
}

export const GET = withAuth(handleGet)
