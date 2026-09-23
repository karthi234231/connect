// src/app/actions/matches.ts
// Matches read + dismiss boundary: wraps getMatches so the client never
// invents rows; dismiss delegating to the matches table's pending→declined
// transition; swipe quota read straight off the same swipe_daily_quota table
// the perform_swipe RPC enforces against.
'use server'

import { z } from 'zod'

import type { MatchStatus } from '@/types/match'
import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { uuidSchema } from '@/lib/validation'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { declineMatch, getMatches } from '@/services/matching/match.service'

export type MatchesActionResult = Awaited<ReturnType<typeof getMatches>>

const matchIdInputSchema = z.object({ matchId: uuidSchema }).strict()

const matchStatusSchema = z.enum(['pending', 'active', 'declined']).optional()

export async function getMatchesAction(
  status?: MatchStatus,
): Promise<MatchesActionResult> {
  const userId = await requireUser()
  const parsedStatus = matchStatusSchema.safeParse(status)
  if (!parsedStatus.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid match status filter.')
  }
  const matches = await getMatches(userId)
  return parsedStatus.data
    ? matches.filter((match) => match.status === parsedStatus.data)
    : matches
}

/**
 * Dismiss a match from the matches list. Backed by the matches table's
 * existing pending→declined transition (`declineMatch`), so it only applies
 * to still-pending matches; active threads cannot be dismissed with today's
 * schema (no archive/block table for matches — see UI-15 note).
 */
export async function dismissMatchAction(input: {
  matchId: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = matchIdInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That match cannot be dismissed.')
  }

  return declineMatch(userId, parsed.data.matchId)
}

/** Cap set by migration 20260915000000_swipe_daily_quota.sql (10 like/spark/day). */
const SWIPE_DAILY_TOTAL = 10

export interface SwipeQuotaResult {
  /** Swipes still available today; the same number the perform_swipe RPC reports. */
  remaining: number
  total: number
}

/**
 * Today's remaining right-swipe quota, read from the same `swipe_daily_quota`
 * row the perform_swipe RPC enforces against. Null on failure (never fail the
 * page). No row today means nothing consumed — full quota remains.
 */
export async function getSwipeQuotaAction(): Promise<SwipeQuotaResult | null> {
  const userId = await requireUser()

  // Quota day is now()::date (UTC) in the RPC — mirror it with the UTC date.
  const today = new Date().toISOString().slice(0, 10)

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('swipe_daily_quota')
    .select('used_count')
    .eq('user_id', userId)
    .eq('quota_day', today)
    .maybeSingle()

  if (error) {
    logger.warn('getSwipeQuotaAction: quota read failed', {
      userId,
      error: error.message,
    })
    return null
  }

  const used = data ? Math.max(Number(data.used_count) || 0, 0) : 0

  return {
    remaining: Math.min(
      Math.max(SWIPE_DAILY_TOTAL - used, 0),
      SWIPE_DAILY_TOTAL,
    ),
    total: SWIPE_DAILY_TOTAL,
  }
}
