// src/lib/cache/index.ts
import { randomUUID } from 'crypto'
import { unstable_cache, revalidateTag as nextRevalidateTag } from 'next/cache'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { redis } from '@/lib/redis'

export const CACHE_TAGS = {
  profile: (userId: string): `profile:${string}` => `profile:${userId}`,
  settings: (userId: string): `settings:${string}` => `settings:${userId}`,
  matches: (userId: string): `matches:${string}` => `matches:${userId}`,
  discover: (userId: string): `discover:${string}` => `discover:${userId}`,
  events: 'events:upcoming' as const,
  traction: 'traction:daily' as const,
  matchingWeights: 'matching:weights' as const,
  ideas: 'ideas:feed' as const,
  connections: (userId: string): `connections:${string}` =>
    `connections:${userId}`,
} as const

export type CacheTag =
  | `profile:${string}`
  | `settings:${string}`
  | `matches:${string}`
  | `discover:${string}`
  | `connections:${string}`
  | 'events:upcoming'
  | 'traction:daily'
  | 'matching:weights'
  | 'ideas:feed'

export function revalidateTag(tag: CacheTag) {
  nextRevalidateTag(tag, {})
  logger.debug(`Cache tag invalidated: ${tag}`)
}

export function revalidateTags(tags: CacheTag[]) {
  tags.forEach((tag) => nextRevalidateTag(tag, {}))
  logger.debug(`Cache tags invalidated: ${tags.join(', ')}`)
}

export interface CacheOptions {
  key: string[]
  tags?: CacheTag[]
  ttl?: number
  stale?: boolean
  logContext?: Record<string, unknown>
  useStampedeGuard?: boolean
}

interface CachedOptions {
  cacheKey: string
  tags: CacheTag[]
  ttl: number
  stale: boolean
  logContext?: Record<string, unknown>
}

function makeCachedFn<T>(
  fn: () => Promise<T>,
  key: string[],
  opts: CachedOptions,
) {
  return unstable_cache(
    async () => {
      const start = performance.now()
      const result = await fn()
      const duration = Math.round(performance.now() - start)
      logger.debug(`Cache miss / recomputed: ${opts.cacheKey}`, {
        tags: opts.tags,
        durationMs: duration,
        ...opts.logContext,
      })
      return result
    },
    key,
    {
      tags: opts.tags,
      revalidate: opts.ttl,
      ...(opts.stale && { stale: true }),
    },
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const inflight = new Map<string, Promise<unknown>>()
const LOCK_TTL_MS = 5_000
const POLL_BACKOFF_MS = 50
const MAX_POLLS = 20

async function stampedeGuarded<T>(
  cachedFn: () => Promise<T>,
  opts: CachedOptions,
): Promise<T> {
  const cacheKey = opts.cacheKey
  const existing = inflight.get(cacheKey) as Promise<T> | undefined
  if (existing) return existing

  const run = (async () => {
    const token = randomUUID()
    const lockKey = `stampede:lock:${cacheKey}`
    let acquired = false
    try {
      acquired = Boolean(
        await redis.set(lockKey, token, { nx: true, px: LOCK_TTL_MS }),
      )
    } catch (error) {
      logger.warn(`Stampede guard lock unavailable for ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      })
      return cachedFn()
    }

    if (acquired) {
      try {
        const value = await cachedFn()
        await redis.del(lockKey).catch(() => {})
        logger.debug(`Stampede guard: computed + warmed ${cacheKey}`)
        return value
      } catch (error) {
        await redis.del(lockKey).catch(() => {})
        throw error
      }
    }

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_BACKOFF_MS)
      let held: string | null = null
      try {
        held = await redis.get(lockKey)
      } catch {
        break
      }
      if (!held) {
        logger.debug(`Stampede guard: served from warm cache ${cacheKey}`)
        return cachedFn()
      }
    }
    logger.debug(`Stampede guard: timeout fallback read ${cacheKey}`)
    return cachedFn()
  })().finally(() => {
    inflight.delete(cacheKey)
  })

  inflight.set(cacheKey, run)
  return run
}

export async function getCached<T>(
  fn: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const {
    key,
    tags = [],
    ttl = 60,
    stale = false,
    logContext,
    useStampedeGuard = false,
  } = options
  const cacheKey = key.join(':')
  const cachedFn = makeCachedFn<T>(fn, key, {
    cacheKey,
    tags,
    ttl,
    stale,
    logContext,
  })

  try {
    if (useStampedeGuard) {
      return await stampedeGuarded<T>(cachedFn, {
        cacheKey,
        tags,
        ttl,
        stale,
        logContext,
      })
    }
    return await cachedFn()
  } catch (error) {
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL, {
      context: { cacheKey, tags },
    })
  }
}

export function invalidateUserCache(userId: string) {
  const tags: CacheTag[] = [
    CACHE_TAGS.profile(userId),
    CACHE_TAGS.settings(userId),
    CACHE_TAGS.matches(userId),
    CACHE_TAGS.discover(userId),
    CACHE_TAGS.connections(userId),
  ]
  revalidateTags(tags)
}

/**
 * Invalidate every per-user cache entry that reflects user-to-user
 * relationships: profile, settings, matches, discover feed and connections.
 * Async so callers can await revalidation (e.g. after a match is created)
 * before serving potentially stale reads of the same entry.
 */
export function invalidateEventsCache() {
  revalidateTag(CACHE_TAGS.events)
}

export function invalidateIdeasCache() {
  revalidateTag(CACHE_TAGS.ideas)
}
