// src/app/api/search/route.ts
// Guest-safe search over public projections (profiles + ideas + events).
// Strict query contract: q required, type allowlisted, limit clamped.
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getRequestId } from '@/lib/auth'
import { apiError, apiOk, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  searchEvents,
  searchIdeas,
  searchProfiles,
} from '@/services/search/service'

const QuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100),
    type: z.enum(['all', 'people', 'ideas', 'events']).default('all'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q'),
    type: url.searchParams.get('type') ?? 'all',
    limit: url.searchParams.get('limit') ?? '20',
  })
  if (!parsed.success) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Invalid query parameters.', requestId),
      { status: 400, headers: { 'x-request-id': requestId ?? '' } },
    )
  }
  const { q, type, limit } = parsed.data

  let viewerId: string | undefined
  try {
    viewerId = (await getCurrentSession())?.userId ?? undefined
  } catch {
    viewerId = undefined
  }

  try {
    const [people, ideas, events] = await Promise.all([
      type === 'all' || type === 'people'
        ? searchProfiles(q, { limit, viewerId })
        : Promise.resolve(null),
      type === 'all' || type === 'ideas'
        ? searchIdeas(q, { limit, viewerId })
        : Promise.resolve([]),
      type === 'all' || type === 'events'
        ? searchEvents(q, { limit, viewerId })
        : Promise.resolve([]),
    ])

    return NextResponse.json(
      apiOk({
        query: q,
        people: people?.items ?? [],
        ideas,
        events,
      }),
      { headers: { 'x-request-id': requestId ?? '' } },
    )
  } catch (error) {
    logger.error('Search API failed', { requestId, error })
    return NextResponse.json(
      apiError(ErrorCodes.INTERNAL, 'Unable to search.', requestId),
      { status: 500, headers: { 'x-request-id': requestId ?? '' } },
    )
  }
}

async function getCurrentSession(): Promise<{ userId: string } | null> {
  const { getCurrentSession: resolveSession } = await import('@/lib/auth')
  return resolveSession()
}
