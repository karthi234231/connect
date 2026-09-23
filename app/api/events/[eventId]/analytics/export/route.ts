// src/app/api/events/[eventId]/analytics/export/route.ts
// CSV / JSON export for event analytics. Used by AnalyticsExportMenu (features/events).
// The response is a downloadable blob (Content-Type header set to text/csv or
// application/json); no JSON envelope. Auth is verified the same way as the
// analytics GET: only the organizer can export.

import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes, apiError } from '@/lib/errors'
import { resolveEventAnalytics } from '@/features/events'

function buildCsv(analytics: {
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
}): string {
  const lines: string[] = []

  lines.push('Metric,Value')
  lines.push(`Event ID,${analytics.eventId}`)
  lines.push(`Views,${analytics.views}`)
  lines.push(`Unique Views,${analytics.uniqueViews}`)
  lines.push(`Registrations,${analytics.registrations}`)
  lines.push(`Cancellations,${analytics.cancellations}`)
  lines.push(`Waitlist,${analytics.waitlistCount}`)
  lines.push(`Checked In,${analytics.checkedInCount}`)
  lines.push(`Conversion Rate,${(analytics.conversionRate * 100).toFixed(2)}%`)

  lines.push('')
  lines.push('Date,Views')
  for (const row of analytics.viewsByDay) {
    lines.push(`${row.date},${row.views}`)
  }

  lines.push('')
  lines.push('Date,Registrations')
  for (const row of analytics.registrationsByDay) {
    lines.push(`${row.date},${row.registrations}`)
  }

  return lines.join('\n')
}

async function handleGet(
  session: import('@/lib/auth').CurrentSession,
  request: Request,
  ctx?: { params: Promise<{ eventId: string }> },
) {
  const eventId = (await ctx?.params)?.eventId

  if (!eventId) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Missing eventId.'),
      { status: 400 },
    )
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Provide format=csv or format=json.'),
      { status: 400 },
    )
  }

  try {
    const analytics = await resolveEventAnalytics(eventId, session.userId)

    if (format === 'json') {
      return new NextResponse(JSON.stringify(analytics, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="event-${eventId}-analytics.json"`,
        },
      })
    }

    const csv = buildCsv(analytics)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${eventId}-analytics.csv"`,
      },
    })
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCodes.FORBIDDEN) {
      return NextResponse.json(apiError(ErrorCodes.FORBIDDEN, 'Forbidden.'), {
        status: 403,
      })
    }
    logger.error('Event analytics export API failed', { eventId, error })

    return NextResponse.json(
      apiError(ErrorCodes.INTERNAL, 'Unable to export analytics.'),
      { status: 500 },
    )
  }
}

export const GET = withAuth(handleGet)
