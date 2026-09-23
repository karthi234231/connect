// src/services/metrics/service.ts
// Cheap, aggregate-only traction reads for the /traction console.
//
// CONTRACT: every number is a real COUNT over stored rows and every field is
// nullable. Reads are service-role, head-only (no rows leave the server) and
// degrade to `null` on any failure so the UI renders "—" instead of a
// fabricated value or an error boundary. Nothing here is invented.

import { tryGetAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export interface TractionMetrics {
  /** profiles row count. */
  registeredUsers: number | null
  /** matches row count. */
  matchesMade: number | null
  /** events row count. */
  eventsHosted: number | null
  /** messages row count. */
  messagesSent: number | null
}

const EMPTY_TRACTION_METRICS: TractionMetrics = {
  registeredUsers: null,
  matchesMade: null,
  eventsHosted: null,
  messagesSent: null,
}

/**
 * Best-effort aggregate counts (4 head-only counts, one per table).
 * A missing admin client or a failed read returns `null` for that field — the
 * caller renders "—", never a guessed number.
 */
export async function getTractionMetrics(): Promise<TractionMetrics> {
  const admin = tryGetAdminSupabaseClient()

  if (!admin) {
    return EMPTY_TRACTION_METRICS
  }

  const client = admin
  async function countRows(
    table: 'profiles' | 'matches' | 'events' | 'messages',
  ) {
    const { count, error } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })

    if (error) {
      logger.warn('Traction metric read failed', {
        table,
        error: error.message,
      })
      return null
    }

    return count ?? null
  }

  const [registeredUsers, matchesMade, eventsHosted, messagesSent] =
    await Promise.all([
      countRows('profiles'),
      countRows('matches'),
      countRows('events'),
      countRows('messages'),
    ])

  return { registeredUsers, matchesMade, eventsHosted, messagesSent }
}
