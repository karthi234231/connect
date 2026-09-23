import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { runTask } from '@/lib/tasks'
import { enqueueSlackAlert } from '@/services/alerts/slack-outbox'
import { invalidateUserCache } from '@/lib/cache'
import { redis } from '@/lib/redis'
import { checkRateLimit, reportRatelimit } from '@/lib/ratelimit'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import { writeAuditLog, AuditActions } from '@/lib/audit'
import { z } from 'zod'

// ─── Schemas ──────────────────────────────────────────────

export const reportReasonSchema = z.enum([
  'harassment',
  'spam',
  'fake_profile',
  'inappropriate',
  'other',
])

export const reportSchema = z.object({
  reportedId: z.string().uuid('Invalid user ID'),
  reason: reportReasonSchema,
  note: z.string().max(500, 'Note must be at most 500 characters').optional(),
})

export type ReportInput = z.infer<typeof reportSchema>

// ─── Types ──────────────────────────────────────────────

export interface Block {
  blockerId: string
  blockedId: string
  createdAt: string
}

export interface Report {
  id: string
  reporterId: string
  reportedId: string
  reason: string
  note?: string
  status: 'open' | 'reviewed' | 'actioned'
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────

const BLOCK_CACHE_TTL = 300
const BLOCK_CACHE_PREFIX = 'blocks:'

async function getCachedBlocks(userId: string): Promise<Set<string>> {
  const cacheKey = `${BLOCK_CACHE_PREFIX}${userId}`

  try {
    const cached = await redis.get(cacheKey)

    if (typeof cached === 'string') {
      const parsed = JSON.parse(cached) as unknown

      if (
        Array.isArray(parsed) &&
        parsed.every((value) => typeof value === 'string')
      ) {
        logger.debug('Block list cache hit', {
          userId,
          count: parsed.length,
        })

        return new Set(parsed)
      }
    }
  } catch (error: unknown) {
    logger.warn('Block list cache read failed', {
      userId,
      error,
    })
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)

  if (error) {
    logger.error('Failed to fetch block list', {
      userId,
      error: error.message,
    })

    // #56: fail closed — do not treat DB failure as "no blocks".
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify block status', {
      cause: error,
    })
  }

  const blockedIds =
    (
      data as Array<{
        blocked_id: string
      }> | null
    )?.map((row) => row.blocked_id) ?? []

  const blockSet = new Set(blockedIds)

  try {
    await redis.setex(cacheKey, BLOCK_CACHE_TTL, JSON.stringify(blockedIds))
  } catch (error: unknown) {
    logger.warn('Failed to cache block list', {
      userId,
      error,
    })
  }

  return blockSet
}

async function invalidateBlockCache(userId: string): Promise<void> {
  const cacheKey = `${BLOCK_CACHE_PREFIX}${userId}`

  try {
    await redis.del(cacheKey)
  } catch (error: unknown) {
    logger.warn('Failed to invalidate block cache', {
      userId,
      error,
    })
  }
}

export async function isBlocked(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  if (blockerId === blockedId) {
    return false
  }

  const blocks = await getCachedBlocks(blockerId)

  return blocks.has(blockedId)
}

export async function areBlocked(
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  if (userIdA === userIdB) {
    return false
  }

  const [blocksA, blocksB] = await Promise.all([
    getCachedBlocks(userIdA),
    getCachedBlocks(userIdB),
  ])

  return blocksA.has(userIdB) || blocksB.has(userIdA)
}

// ─── Block Service ──────────────────────────────────────

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  if (blockerId === blockedId) {
    throw new AppError(ErrorCodes.VALIDATION, 'You cannot block yourself')
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('blocks').upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: 'blocker_id,blocked_id',
      ignoreDuplicates: true,
    },
  )

  if (error) {
    logger.error('Failed to block user', {
      blockerId,
      blockedId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to block user', {
      cause: error,
    })
  }

  await invalidateBlockCache(blockerId)
  await invalidateBlockCache(blockedId)

  invalidateUserCache(blockerId)
  invalidateUserCache(blockedId)

  await trackFunnel({
    eventName: FunnelEvents.BlockCreated,
    actorId: blockerId,
    entityType: 'user',
    entityId: blockedId,
    result: 'blocked',
    surface: 'safety',
  })

  await writeAuditLog({
    actorId: blockerId,
    actorType: 'user',
    action: AuditActions.UserBlocked,
    entityType: 'user',
    entityId: blockedId,
  })

  logger.info('User blocked', {
    blockerId,
    blockedId,
  })
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  if (error) {
    logger.error('Failed to unblock user', {
      blockerId,
      blockedId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to unblock user', {
      cause: error,
    })
  }

  await invalidateBlockCache(blockerId)
  await invalidateBlockCache(blockedId)

  invalidateUserCache(blockerId)
  invalidateUserCache(blockedId)

  logger.info('User unblocked', {
    blockerId,
    blockedId,
  })
}

// ─── Report Service ─────────────────────────────────────

export interface ReportRecordResult {
  reportId: string
  deduped: boolean
  priority: number
}

export interface CreateReportRecordInput {
  /** Acting user from the trusted auth context — never client-supplied. */
  reporterId: string
  /** Server-resolved target user id (reports.reported_id FK → auth.users). */
  reportedId: string
  /** Optional conversation scoping (V10-BE-04 reportConversation). */
  reportedMatchId?: string | null
  reason: string
  note?: string
}

/**
 * Shared canonical report writer used by both `reportUser` and the
 * relationship-safety module's `reportConversation` (one reporting code path).
 * Enforces:
 * - per-reporter rate limit (same budget for user and conversation reports)
 * - open-report dedupe, scoped to the target and, for conversation reports,
 *   to the specific match so a user report and a conversation report about the
 *   same person stay distinct rows
 * - a moderation priority heuristic (distinct prior reporters via the
 *   service-role client — the user-scoped RLS client can never see other
 *   reporters' rows, so the count would otherwise always be 0)
 * plus audit + funnel + best-effort auto-block + fire-and-forget Slack alert.
 */
export async function createReportRecord(
  input: CreateReportRecordInput,
): Promise<ReportRecordResult> {
  const { reporterId, reportedId, reportedMatchId, reason, note } = input

  const supabase = await createServerSupabaseClient()

  // #88 — per-reporter abuse protection: bound moderation load a single
  // reporter can create. A reporter is RATE_LIMITED if they exceed the
  // window budget (5/min), independent of how many targets they hit.
  const rateLimit = await checkRateLimit(
    `report:${reporterId}`,
    reportRatelimit,
  )

  if (!rateLimit.success) {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      'Too many reports. Please try again later.',
    )
  }

  // #88 — dedupe: an already-open report from this reporter about this target
  // returns the existing report id instead of creating unbounded duplicate
  // rows / repeated moderation load. Conversation reports are additionally
  // scoped by reported_match_id.
  let dedupeQuery = supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('reported_id', reportedId)
    .eq('status', 'open')

  if (reportedMatchId) {
    dedupeQuery = dedupeQuery.eq('reported_match_id', reportedMatchId)
  }

  const { data: existing } = await dedupeQuery.maybeSingle()

  if (existing?.id) {
    return { reportId: existing.id, deduped: true, priority: 0 }
  }

  // #88 — moderation priority heuristic: reports against a target accumulate
  // priority with the number of DISTINCT prior reporters. The count MUST go
  // through the service-role client: the reports SELECT policy only exposes
  // the caller's own rows, so the user-scoped client would silently count 0
  // (defect fixed as part of the V10-BE-04 refactor).
  const { count } = await getAdminSupabaseClient()
    .from('reports')
    .select('reporter_id', { count: 'exact', head: true })
    .eq('reported_id', reportedId)
    .neq('reporter_id', reporterId)

  const distinctPriorReporters = count ?? 0

  const priority = Math.min(distinctPriorReporters + 1, 10)

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      reported_match_id: reportedMatchId ?? null,
      reason,
      note: note ?? null,
      status: 'open',
      priority,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !report) {
    logger.error('Failed to create report', {
      reporterId,
      reportedId,
      error: error?.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to report user', {
      cause: error,
    })
  }

  await writeAuditLog({
    actorId: reporterId,
    actorType: 'user',
    action: AuditActions.ReportSubmitted,
    entityType: reportedMatchId ? 'conversation' : 'report',
    entityId: reportedMatchId ?? report.id,
    note: reason,
  })

  try {
    await blockUser(reporterId, reportedId)
  } catch (error: unknown) {
    logger.warn('Auto-block after report failed', {
      reporterId,
      reportedId,
      error,
    })
  }

  await trackFunnel({
    eventName: FunnelEvents.ReportSubmitted,
    actorId: reporterId,
    entityType: reportedMatchId ? 'conversation' : 'user',
    entityId: reportedMatchId ?? reportedId,
    result: 'open',
    surface: 'safety',
    meta: { priority },
  })

  await runTask(
    async () => {
      const [reporterResult, reportedResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', reporterId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', reportedId)
          .single(),
      ])

      if (reporterResult.error || reportedResult.error) {
        logger.warn('Failed to fetch profiles for report alert', {
          reporterId,
          reportedId,
        })

        return
      }

      // HOST-ASYNC-03 — durable outbox enqueue (dedupe: one alert per
      // report) instead of an inline Slack POST that a crash could drop.
      // #113 — idempotencyKey equals the dedupe_key; a retried task
      // collides (23505) and reuses the row, so the alert fires once.
      await enqueueSlackAlert({
        dedupeKey: `report-alert-${report.id}`,
        text:
          `New Report\n` +
          `Reporter: ${reporterResult.data.full_name}\n` +
          `Reported: ${reportedResult.data.full_name}\n` +
          `Reason: ${reason}\n` +
          `Note: ${note ?? '(no note)'}\n` +
          `Report ID: ${report.id}` +
          (reportedMatchId ? `\nConversation: ${reportedMatchId}` : ''),
      })
    },
    {
      id: `report-alert-${report.id}`,
      idempotencyKey: `report-alert-${report.id}`,
    },
  )

  await invalidateBlockCache(reporterId)

  logger.info('Report created', {
    reportId: report.id,
    reporterId,
    reportedId,
    priority,
  })

  return {
    reportId: report.id,
    deduped: false,
    priority,
  }
}

/** User-scoped report (V10-BE-04: target is a user id, no match scoping). */
export async function reportUser(
  reporterId: string,
  input: ReportInput,
): Promise<ReportRecordResult> {
  const validated = reportSchema.parse(input)

  if (reporterId === validated.reportedId) {
    throw new AppError(ErrorCodes.VALIDATION, 'You cannot report yourself')
  }

  return createReportRecord({
    reporterId,
    reportedId: validated.reportedId,
    reportedMatchId: null,
    reason: validated.reason,
    note: validated.note,
  })
}

// ─── Safety Exclusions ──────────────────────────────────

export async function filterBlockedCandidates<
  T extends {
    id: string
  },
>(userId: string, candidates: T[]): Promise<T[]> {
  if (candidates.length === 0) {
    return []
  }

  const candidateIds = Array.from(
    new Set(candidates.map((candidate) => candidate.id)),
  )

  const blocks = await getCachedBlocks(userId)

  const remainingIds = candidateIds.filter((id) => !blocks.has(id))

  if (remainingIds.length === 0) {
    return []
  }

  const supabase = await createServerSupabaseClient()

  const { data: reverseBlocks, error } = await supabase
    .from('blocks')
    .select('blocker_id')
    .eq('blocked_id', userId)
    .in('blocker_id', remainingIds)

  if (error) {
    logger.error('Failed to fetch reverse blocks', {
      userId,
      error: error.message,
    })

    // #56: fail closed — do not allow candidates we cannot verify.
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify block status', {
      cause: error,
    })
  }

  const reverseBlockerIds =
    (
      reverseBlocks as Array<{
        blocker_id: string
      }> | null
    )?.map((row) => row.blocker_id) ?? []

  const blockedBy = new Set(reverseBlockerIds)

  return candidates.filter((candidate) => {
    const blocked = blocks.has(candidate.id) || blockedBy.has(candidate.id)

    return !blocked
  })
}

export async function isBlockedPair(
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  return areBlocked(userIdA, userIdB)
}

// ─── Blocked-user management (P0-24) ────────────────────────
// A caller's own block list with the public-safe counterpart identity, so the
// safety settings page can render an unblock surface. Only the caller's own
// blocks are ever returned (RLS + explicit blocker_id predicate).

export interface BlockedUser {
  id: string
  fullName: string
  avatarUrl: string | null
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const supabase = await createServerSupabaseClient()

  // Two-step read (no FK join): the generated types don't model a
  // blocks→profiles relationship, and the profiles read is RLS-scoped anyway.
  const { data: blockRows, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to list blocked users', {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load blocked users', {
      cause: error,
    })
  }

  const blockedIds = (blockRows ?? []).map((row) => row.blocked_id)
  if (blockedIds.length === 0) return []

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', blockedIds)

  if (profileError) {
    logger.error('Failed to load blocked profiles', {
      userId,
      error: profileError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load blocked users', {
      cause: profileError,
    })
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const))

  return blockedIds.map((id) => {
    const profile = byId.get(id)
    return {
      id,
      // A profile hidden by RLS renders as a generic label — never fabricated.
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
    }
  })
}
