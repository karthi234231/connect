// src/app/actions/discover.ts
// S47 — Discover batch boundary. Cursors are user-bound: a tampered, malformed
// or foreign token yields the empty `version: "invalid"` batch and NEVER pages.
'use server'

import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import {
  decodeCursorToken,
  getDiscoverBatch,
  type DiscoverBatch,
} from '@/services/discover/candidates.service'
import type { MatchFiltersInput } from '@/services/matching/filters.schema'

/** Deck refill size — small batches keep the swipe loop latency-bounded. */
const ACTION_BATCH_LIMIT = 5

/** Non-pageable batch: nothing is read and no cursor is issued. */
export interface InvalidDiscoverBatch {
  items: []
  nextCursorToken: null
  version: 'invalid'
}

function invalidBatch(): InvalidDiscoverBatch {
  return { items: [], nextCursorToken: null, version: 'invalid' }
}

export async function fetchDiscoverBatchAction(
  cursor: string | null,
  filters?: MatchFiltersInput,
): Promise<DiscoverBatch | InvalidDiscoverBatch> {
  const userId = await requireUser()

  let offset = 0

  if (cursor) {
    const decoded = decodeCursorToken(cursor)

    if (!decoded || decoded.userId !== userId) {
      logger.warn('fetchDiscoverBatchAction: rejected cursor', {
        userId,
        reason: decoded ? 'foreign' : 'malformed',
      })
      return invalidBatch()
    }

    offset = decoded.offset
  }

  return getDiscoverBatch(userId, {
    offset,
    limit: ACTION_BATCH_LIMIT,
    ...(filters ? { filters } : {}),
  })
}
