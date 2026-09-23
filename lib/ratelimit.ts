// src/lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// Use centralized Redis client from @/lib/redis (#133)

// ─── Pre‑configured limiters ──────────────────────────────

/**
 * Auth limiter: 10 requests per minute per identifier.
 * Used for login, signup, password reset.
 */
export type RatelimitClient = Ratelimit

export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'rl:auth',
})

/**
 * Read limiter: 100 requests per minute per identifier.
 * Used for GET requests, profile views, feed fetches.
 */
export const readRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
  prefix: 'rl:read',
})

/**
 * Write limiter: 30 requests per minute per identifier.
 * Used for mutations, chat sends, swipes, profile updates.
 */
export const writeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
  prefix: 'rl:write',
})

// ——— Operation-group limiters (audit #86) ———
// Per-user + operation-group budget. Moving requests between endpoint paths
// can no longer multiply the effective budget: the identifier is the user and
// the OPERATION GROUP, not the specific path.
/**
 * Swipe limiter: 100/min/user.
 */
export const swipeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
  prefix: 'rl:swipe',
})

/**
 * Search limiter: 60/min/user.
 */
export const searchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  analytics: true,
  prefix: 'rl:search',
})

/**
 * Message limiter: 120/min/user.
 */
export const messageRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '60 s'),
  analytics: true,
  prefix: 'rl:message',
})

/**
 * Auth limiter (IP-scoped): 10/min/IP across all auth endpoints.
 * Separate from `authRatelimit` (which is per-identifier/unauthenticated) so
 * the proxy can scope auth by IP for unauthenticated requests.
 */
export const authIpRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'rl:auth-ip',
})

/**
 * Report limiter: 5 reports/min/reporter (audit #88) — bounds moderation load
 * created by a single abusive reporter.
 */
export const reportRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
  prefix: 'rl:report',
})

/**
 * Join-request limiter: 30/min/user (audit #122) — bounds the number of idea
 * join requests a single user can file in a window. The DB UNIQUE
 * (idea_id, user_id) enforces one-per-idea ever; this stops a user spraying
 * join requests across many different ideas within budget.
 */
export const joinRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
  prefix: 'rl:join',
})

// ─── Generic factory ───────────────────────────────────────

/**
 * Create a custom rate limiter with arbitrary limits.
 */
export function createRatelimit(
  limit: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h'}`,
  prefix: string,
) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  })
}

// ─── Helper to check and log ──────────────────────────────

/**
 * Check if a request is rate limited.
 * Returns success, limit, remaining, reset (timestamp).
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit = authRatelimit,
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    logger.warn(`Rate limit exceeded`, {
      identifier,
      limit,
      remaining,
      reset: new Date(reset).toISOString(),
    })
  }

  return { success, limit, remaining, reset }
}

// ─── Response header helpers ───────────────────────────────

/**
 * Get rate limit headers for a response.
 */
export function getRateLimitHeaders(
  result: {
    limit: number
    remaining: number
    reset: number
  },
  limited = false,
): Record<string, string> {
  const resetInSeconds = Math.max(
    0,
    Math.ceil((result.reset - Date.now()) / 1000),
  )

  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(resetInSeconds),
    ...(limited ? { 'Retry-After': String(resetInSeconds) } : {}),
  }
}
