import { requireAdmin } from '@/lib/auth'
import { writeAuditLog, AuditActions } from '@/lib/audit'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { invalidateUserCache } from '@/lib/cache'
import { invalidateSuspensionCache } from '@/lib/suspension'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  toReportQueueItemDTO,
  toAdminUserRowDTO,
  toAdminEventRowDTO,
  toAdminAuditLogDTO,
  decodeKeysetCursor,
  encodeKeysetCursor,
  type ReportRow,
  type AdminProfileRow,
  type AdminEventRow,
  type AdminEventRowDTO,
  type AdminAuditLogRow,
  type AdminAuditLogDTO,
} from '@/lib/dto-admin'

function getAdmin() {
  const admin = getAdminSupabaseClient()

  if (!admin) {
    throw new AppError(ErrorCodes.INTERNAL, 'Admin client unavailable')
  }

  return admin
}

export async function getReportQueue(status?: string, limit = 50) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  let query = admin
    .from('reports')
    .select('id, reporter_id, reported_id, reason, note, status, created_at')
    .order('created_at', {
      ascending: false,
    })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    logger.error('getReportQueue failed', {
      actorId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load report queue', {
      cause: error,
    })
  }

  return (data ?? []).map((report) => toReportQueueItemDTO(report as ReportRow))
}

export async function reviewReport(reportId: string, note?: string) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const { data, error } = await admin
    .from('reports')
    .update({
      status: 'reviewed',
      note: note ?? null,
    })
    .eq('id', reportId)
    .eq('status', 'open')
    .select('id, reporter_id, reported_id, reason, note, status, created_at')
    .maybeSingle()

  if (error) {
    logger.error('reviewReport failed', {
      actorId,
      reportId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to review report', {
      cause: error,
    })
  }

  if (!data) {
    throw AppError.notFound('Open report', reportId)
  }

  await writeAuditLog({
    actorId,
    actorType: 'admin',
    action: AuditActions.ReportReviewed,
    entityType: 'report',
    entityId: reportId,
    note: note ?? undefined,
  })

  await trackFunnel({
    eventName: FunnelEvents.AdminReportReviewed,
    actorId,
    entityType: 'report',
    entityId: reportId,
  })

  return toReportQueueItemDTO(data as ReportRow)
}

export async function resolveReport(reportId: string, note?: string) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const { data, error } = await admin
    .from('reports')
    .update({
      status: 'actioned',
      note: note ?? null,
    })
    .eq('id', reportId)
    // #123 — explicit state machine: open → reviewed → actioned. A report
    // must be reviewed before it can be actioned; arbitrary jumps
    // (open → actioned) are rejected by this conditional update.
    .eq('status', 'reviewed')
    .select('id, reporter_id, reported_id, reason, note, status, created_at')
    .maybeSingle()

  if (error) {
    logger.error('resolveReport failed', {
      actorId,
      reportId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to resolve report', {
      cause: error,
    })
  }

  if (!data) {
    throw AppError.notFound('Actionable report', reportId)
  }

  await writeAuditLog({
    actorId,
    actorType: 'admin',
    action: AuditActions.ReportResolved,
    entityType: 'report',
    entityId: reportId,
    note: note ?? undefined,
  })

  await trackFunnel({
    eventName: FunnelEvents.AdminReportReviewed,
    actorId,
    entityType: 'report',
    entityId: reportId,
    result: 'resolved',
  })

  return toReportQueueItemDTO(data as ReportRow)
}

export async function suspendUser(userId: string, reason?: string) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  if (userId === actorId) {
    throw AppError.forbidden('You cannot suspend your own account.')
  }

  const { data, error } = await admin
    .from('profiles')
    .update({
      suspended_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, full_name, role, created_at, last_active_at, suspended_at')
    .maybeSingle()

  if (error) {
    logger.error('suspendUser failed', {
      actorId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to suspend user', {
      cause: error,
    })
  }

  if (!data) {
    throw AppError.notFound('User', userId)
  }

  await writeAuditLog({
    actorId,
    actorType: 'admin',
    action: AuditActions.UserSuspended,
    entityType: 'user',
    entityId: userId,
    note: reason ?? undefined,
  })

  logger.info('User suspended', {
    actorId,
    userId,
    reason,
  })

  // #81 — suspension must take effect immediately, not only on the next request:
  //   - invalidate the user's app caches so stale cached views cannot persist;
  //   - revoke the user's GoTrue sessions/refresh tokens so an already
  //     authenticated session cannot continue. Best-effort: even if revocation
  //     fails, requireActiveUser()/requireCapability() still hard-block suspense
  //     server-side on every sensitive action (defense-in-depth).
  invalidateUserCache(userId)
  await invalidateSuspensionCache(userId)

  try {
    await admin.auth.admin.signOut(userId, 'global')
    logger.info('Revoked sessions for suspended user', { userId })
  } catch (revokeError) {
    logger.warn('Session revocation failed (defense-in-depth still blocks)', {
      userId,
      error:
        revokeError instanceof Error
          ? revokeError.message
          : String(revokeError),
    })
  }

  return toAdminUserRowDTO(data as AdminProfileRow)
}

export async function unsuspendUser(userId: string, reason?: string) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const { data, error } = await admin
    .from('profiles')
    .update({
      suspended_at: null,
    })
    .eq('id', userId)
    .select('id, full_name, role, created_at, last_active_at, suspended_at')
    .maybeSingle()

  if (error) {
    logger.error('unsuspendUser failed', {
      actorId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to unsuspend user', {
      cause: error,
    })
  }

  if (!data) {
    throw AppError.notFound('User', userId)
  }

  await writeAuditLog({
    actorId,
    actorType: 'admin',
    action: AuditActions.UserUnsuspended,
    entityType: 'user',
    entityId: userId,
    note: reason ?? undefined,
  })

  logger.info('User unsuspended', {
    actorId,
    userId,
    reason,
  })

  await invalidateSuspensionCache(userId)

  return toAdminUserRowDTO(data as AdminProfileRow)
}

const ADMIN_USERS_MAX_PAGE_SIZE = 100

/**
 * #79 — keyset-paginated admin user listing (order: created_at DESC, id DESC).
 * Bounded per page (max 100) so performance stays constant at 1M+ users.
 * Returns a `nextCursor` token (opaque `created_at|id`) for the next page, or
 * null when there are no further rows.
 */
export async function getAdminUsers(
  cursor?: string | null,
  pageSize = 50,
): Promise<{
  items: ReturnType<typeof toAdminUserRowDTO>[]
  nextCursor: string | null
}> {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const limit = Math.min(Math.max(pageSize, 1), ADMIN_USERS_MAX_PAGE_SIZE)

  // Cursor decoded: one row beyond the page is fetched to detect `nextCursor`.
  const fetchLimit = limit + 1

  let query = admin
    .from('profiles')
    .select('id, full_name, role, created_at, last_active_at, suspended_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  if (cursor) {
    const [createdAt, id] = cursor.split('|', 2)

    if (createdAt && id) {
      query = query.or(
        `and(created_at.lt.${createdAt}),and(created_at.eq.${createdAt},id.lt.${id})`,
      )
    }
  }

  const { data, error } = await query

  if (error) {
    logger.error('getAdminUsers failed', {
      actorId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load users', {
      cause: error,
    })
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>

  const hasMore = rows.length > limit

  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const items = pageRows.map((user) =>
    toAdminUserRowDTO(user as unknown as AdminProfileRow),
  )

  const last = pageRows[pageRows.length - 1]

  const nextCursor =
    hasMore && last ? `${String(last.created_at)}|${String(last.id)}` : null

  return { items, nextCursor }
}

export async function bulkModerate(
  reportIds: string[],
  action: 'review' | 'resolve',
  note?: string,
) {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  if (!reportIds.length) {
    return {
      processed: 0,
      changed: 0,
      skipped: 0,
      failed: 0,
      idempotent: true,
    }
  }

  // #123 — state machine: open → reviewed → actioned. Each action has a
  // single valid source status; arbitrary jumps are rejected.
  const VALID_SOURCES: Record<'review' | 'resolve', string> = {
    review: 'open',
    resolve: 'reviewed',
  }
  const targetStatus = action === 'review' ? 'reviewed' : 'actioned'
  const requiredSource = VALID_SOURCES[action]

  // #80 — idempotent state transitions. First read the current status of every
  // requested report so the outcome can attribute each id to changed/skipped/
  // failed; then apply a conditional UPDATE (WHERE status = source). Re-running
  // the same request never re-applies an already-reached state.
  const { data: beforeData, error: beforeError } = await admin
    .from('reports')
    .select('id, status')
    .in('id', reportIds)

  if (beforeError) {
    logger.error('bulkModerate: read-before failed', {
      actorId,
      count: reportIds.length,
      action,
      error: beforeError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to bulk moderate reports', {
      cause: beforeError,
    })
  }

  const beforeById = new Map<string, string>()

  for (const row of (beforeData ?? []) as Array<Record<string, unknown>>) {
    if (typeof row.id === 'string') {
      beforeById.set(row.id, String(row.status ?? ''))
    }
  }

  // #123 — only transition from the valid source status for this action
  const { data, error } = await admin
    .from('reports')
    .update({
      status: targetStatus,
      note: note ?? null,
    })
    .in('id', reportIds)
    .eq('status', requiredSource)
    .select('id')

  if (error) {
    logger.error('bulkModerate failed', {
      actorId,
      count: reportIds.length,
      action,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to bulk moderate reports', {
      cause: error,
    })
  }

  const changedIds = new Set<string>()

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    if (typeof row.id === 'string') {
      changedIds.add(row.id)
    }
  }

  let changed = 0

  let skipped = 0

  let failed = 0

  for (const id of reportIds) {
    if (changedIds.has(id)) {
      changed += 1
    } else {
      const currentStatus = beforeById.get(id)
      // Skipped if already at target OR not in the valid source state
      if (currentStatus === targetStatus || currentStatus !== requiredSource) {
        skipped += 1
      } else {
        failed += 1
      }
    }
  }

  const processed = changed

  await writeAuditLog({
    actorId,
    actorType: 'admin',
    action: AuditActions.ReportBulkModerated,
    entityType: 'report',
    note: `${action}:${processed}`,
    metadata: {
      count: processed,
      changed,
      skipped,
      failed,
      action,
    },
  })

  await trackFunnel({
    eventName: FunnelEvents.AdminReportReviewed,
    actorId,
    entityType: 'report',
    result: action,
    meta: {
      count: processed,
    },
  })

  logger.info('Bulk moderation completed', {
    actorId,
    action,
    changed,
    skipped,
    failed,
  })

  return {
    processed,
    changed,
    skipped,
    failed,
    idempotent: true,
  }
}

/**
 * #79-style keyset-paginated admin event audit listing (order:
 * created_at DESC, id DESC). Same opaque `created_at|id` cursor contract as
 * `getAdminUsers`. Bounded per page (max 100).
 */
const ADMIN_EVENTS_MAX_PAGE_SIZE = 100

export interface AdminEventsPage {
  items: AdminEventRowDTO[]
  nextCursor: string | null
}

export async function getAdminEvents(
  cursor?: string | null,
  pageSize = 50,
): Promise<AdminEventsPage> {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const limit = Math.min(Math.max(pageSize, 1), ADMIN_EVENTS_MAX_PAGE_SIZE)

  // One row beyond the page is fetched to detect `nextCursor`.
  const fetchLimit = limit + 1

  let query = admin
    .from('events')
    .select(
      'id, title, status, visibility, organizer_id, starts_at, created_at, capacity',
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  const { sortValue, id: cursorId } = decodeKeysetCursor(cursor)

  if (sortValue && cursorId) {
    query = query.or(
      `and(created_at.lt.${sortValue}),and(created_at.eq.${sortValue},id.lt.${cursorId})`,
    )
  }

  const { data, error } = await query

  if (error) {
    logger.error('getAdminEvents failed', {
      actorId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load events', {
      cause: error,
    })
  }

  const rows = (data ?? []) as unknown as AdminEventRow[]

  const hasMore = rows.length > limit

  const pageRows = hasMore ? rows.slice(0, limit) : rows

  const items = pageRows.map((row) => toAdminEventRowDTO(row))

  const last = pageRows[pageRows.length - 1]

  const nextCursor =
    hasMore && last ? encodeKeysetCursor(last.created_at, last.id) : null

  return { items, nextCursor }
}

/**
 * Audit-log viewer: last N rows, newest first. The `audit_logs` table is typed
 * in `types/database.ts` (canonical migration 20260903030000), so this is a
 * plain admin-client read. Best-effort reads are cheap because each row is a
 * single row; only the raw row is returned (metadata stays server-side).
 */
const ADMIN_AUDIT_MAX_ROWS = 100

export async function getAdminAuditLogs(
  limit = 50,
): Promise<AdminAuditLogDTO[]> {
  const actorId = await requireAdmin()
  const admin = getAdmin()

  const count = Math.min(Math.max(limit, 1), ADMIN_AUDIT_MAX_ROWS)

  const { data, error } = await admin
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(count)

  if (error) {
    logger.error('getAdminAuditLogs failed', {
      actorId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load audit log', {
      cause: error,
    })
  }

  return (data ?? []).map((row) => toAdminAuditLogDTO(row as AdminAuditLogRow))
}
