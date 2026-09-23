// src/app/api/browse/route.ts
// Guest-safe public feed: ideas + upcoming events (no PII by construction).
// WS-A2 contract:
//   - `?eventId=<uuid>`                     → detail mode `{ data: { event } }`
//   - `?limit&cursor&category&type&format&city&upcoming`
//                                          → list mode `{ data: { ideas, events,
//                                            nextCursor, hasMore } }` PLUS the
//                                            legacy bare top-level `ideas` /
//                                            `events` arrays so the pre-envelope
//                                            consumer (client/api/browse.ts
//                                            fetchBrowse) keeps working.
// Guest requests (no `x-user-id` injected by the proxy) are cached ahead for
// 60s; authenticated / API requests pass through uncached.
import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  getGuestEventDetail,
  getGuestEvents,
  getGuestIdeas,
} from '@/services/guest/browse.service'
import { getRequestId } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { apiError, apiOk, ErrorCodes } from '@/lib/errors'

const QuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(400).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    type: z.enum(['virtual', 'irl']).optional(),
    format: z.string().trim().min(1).max(60).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    upcoming: z.coerce.boolean().optional(),
    eventId: z.string().trim().min(1).max(64).optional(),
  })
  .strict()

function respond(body: unknown, status: number, cacheControl: string) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl },
  })
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  // The proxy only injects x-user-id for verified sessions; its absence is the
  // guest-safe signal that gates shared public caching.
  const isGuest = !request.headers.get('x-user-id')
  const cacheControl = isGuest ? 'public, max-age=60' : 'no-store'

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? '20',
    cursor: url.searchParams.get('cursor') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    format: url.searchParams.get('format') ?? undefined,
    city: url.searchParams.get('city') ?? undefined,
    upcoming: url.searchParams.get('upcoming') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  })

  if (!parsed.success) {
    return respond(
      apiError(ErrorCodes.VALIDATION, 'Invalid query parameters.', requestId),
      400,
      cacheControl,
    )
  }

  const { eventId, limit, cursor, category, type, format, city, upcoming } =
    parsed.data

  try {
    if (eventId) {
      const event = await getGuestEventDetail(eventId)

      if (!event) {
        return respond(
          apiError(ErrorCodes.NOT_FOUND, 'Event not found.', requestId),
          404,
          cacheControl,
        )
      }

      return respond(apiOk({ event }), 200, cacheControl)
    }

    const [{ ideas }, eventPage] = await Promise.all([
      getGuestIdeas({ limit }),
      getGuestEvents({
        limit,
        cursor,
        category,
        type,
        format,
        city,
        upcoming,
      }),
    ])

    const payload = {
      ideas,
      events: eventPage.events,
      nextCursor: eventPage.nextCursor,
      hasMore: eventPage.hasMore,
    }

    // Legacy compatibility: bare top-level arrays (pre-envelope contract) kept
    // alongside the enveloped payload for client/api/browse.ts fetchBrowse.
    return respond(
      { ...apiOk(payload), ideas, events: eventPage.events },
      200,
      cacheControl,
    )
  } catch (error) {
    logger.error('Browse API failed', { requestId, error })

    return respond(
      apiError(ErrorCodes.INTERNAL, 'Unable to load feed.', requestId),
      500,
      cacheControl,
    )
  }
}
