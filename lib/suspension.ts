import type { SupabaseClient } from '@supabase/supabase-js'

import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { Database } from '@/types/database'

const CACHE_TTL_SECONDS = 60
const CACHE_PREFIX = 'suspended:'

/**
 * Reads the profile's suspension flag with a short Redis cache.
 * Accepts the canonical Supabase client (a hand-rolled structural type both
 * fails to match the real client and trips TS2589 on deep instantiation).
 */
export async function isUserSuspended(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIX}${userId}`

  try {
    const cached = await redis.get<boolean>(cacheKey)
    if (typeof cached === 'boolean') return cached
  } catch (error) {
    logger.warn('Suspension cache read failed; checking Postgres', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', userId)
    .single()

  if (error) {
    logger.error('Suspension check failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const suspended = Boolean(data?.suspended_at)
  try {
    await redis.set(cacheKey, suspended, { ex: CACHE_TTL_SECONDS })
  } catch (cacheError) {
    logger.warn('Suspension cache write failed', {
      userId,
      error:
        cacheError instanceof Error ? cacheError.message : String(cacheError),
    })
  }

  return suspended
}

export async function invalidateSuspensionCache(userId: string): Promise<void> {
  try {
    await redis.del(`${CACHE_PREFIX}${userId}`)
  } catch (error) {
    logger.warn('Suspension cache invalidation failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
