// src/app/actions/swipe.ts
// S17/17A + P0-10 — the swipe boundary. The full strict input (opaque
// recommendation id + per-gesture idempotency key) is verified BEFORE the
// mutation seam: snapshot ownership/epoch/expiry are checked server-side and
// the snapshot is claimed once per epoch so a replay cannot double-count.
'use server'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  claimSnapshotForSwipe,
  releaseSnapshotForSwipe,
  verifyRecommendationSnapshot,
} from '@/services/discover/candidates.service'
import { performSwipe } from '@/services/matching/match.service'
import { swipeSchema } from '@/services/matching/swipe.schema'

export interface SwipeActionResult {
  matchCreated: boolean
  matchId?: string
  /** Server-authoritative daily remainder; null when the RPC omits it. */
  quotaRemaining: number | null
}

export async function performSwipeAction(input: {
  candidateId: string
  action: 'like' | 'pass' | 'spark'
  recommendationId: string
  clientIntentId: string
}): Promise<SwipeActionResult> {
  const userId = await requireUser()

  const parsed = swipeSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That swipe could not be saved.')
  }

  // Snapshot verification throws its own AppError codes (INVALID/FORGED/
  // EXPIRED/STALE/VERSION_MISMATCH) — the client branches on them.
  const verified = await verifyRecommendationSnapshot(userId, {
    recommendationId: parsed.data.recommendationId,
    candidateId: parsed.data.candidateId,
  })

  const claimed = await claimSnapshotForSwipe(userId, verified)

  if (!claimed) {
    throw new AppError(
      ErrorCodes.RECOMMENDATION_CONSUMED,
      'That profile was already handled. Refresh your deck.',
    )
  }

  try {
    const result = await performSwipe(
      userId,
      parsed.data.candidateId,
      parsed.data.action,
    )

    return result
  } catch (error) {
    // The mutation never landed — release the claim so the gesture is
    // retryable (quota exhaustion, provider blips) instead of burned.
    await releaseSnapshotForSwipe(userId, verified).catch((releaseError) => {
      logger.warn('performSwipeAction: snapshot release failed', {
        userId,
        error: releaseError,
      })
    })

    throw error
  }
}
