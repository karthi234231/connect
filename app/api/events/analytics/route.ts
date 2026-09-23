// src/app/api/events/analytics/route.ts
// Fetched by useEventAnalytics (features/events/hooks/use-event-analytics.ts).
// Requires a real authenticated session; only the event organizer may read
// analytics (organizerId = the verified caller). Response envelope:
// `{ data: EventAnalyticsDashboard }` — the hook tolerates bare or wrapped.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes, apiError, apiOk } from '@/lib/errors'
import { resolveEventAnalytics } from '@/features/events'

const QuerySchema = z
  .object({
    eventId: z.string().trim().min(1),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
    timezone: z.string().trim().min(1),
  })
  .strict()

async function handleGet(
  session: import('@/lib/auth').CurrentSession,
  request: Request,
) {
  const url = new URL(request.url)

  const parsed = QuerySchema.safeParse({
    eventId: url.searchParams.get('eventId'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    timezone: url.searchParams.get('timezone'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Invalid query parameters.'),
      { status: 400 },
    )
  }

  const { eventId } = parsed.data

  try {
    const analytics = await resolveEventAnalytics(eventId, session.userId)

    return NextResponse.json(apiOk(analytics))
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCodes.FORBIDDEN) {
      return NextResponse.json(apiError(ErrorCodes.FORBIDDEN, 'Forbidden.'), {
        status: 403,
      })
    }
    logger.error('Event analytics API failed', { eventId, error })

    return NextResponse.json(
      apiError(ErrorCodes.INTERNAL, 'Unable to load analytics.'),
      { status: 500 },
    )
  }
}

export const GET = withAuth(handleGet)
