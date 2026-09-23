// src/app/actions/admin.ts
// Admin moderation actions. Privilege is enforced inside the service layer
// (requireAdmin) so every caller — UI or job — passes the same gate. Wire
// failures use canned S55 copy; internal detail stays in the server logs.
'use server'

import { z } from 'zod'

import { toErrorPayload, AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { uuidSchema } from '@/lib/validation'
import {
  getAdminAuditLogs,
  getAdminEvents,
  getAdminUsers,
  getReportQueue,
  resolveReport,
  reviewReport,
  suspendUser,
  unsuspendUser,
} from '@/services/admin/service'
import type {
  AdminAuditLogDTO,
  AdminEventRowDTO,
  AdminUserRowDTO,
  ReportQueueItemDTO,
} from '@/lib/dto-admin'

export interface AdminActionResult {
  ok: boolean
  error: string | null
}

const reportInputSchema = z
  .object({ reportId: uuidSchema, note: z.string().trim().max(500).optional() })
  .strict()

const userInputSchema = z.object({ userId: uuidSchema }).strict()

function failure(scope: string, error: unknown): AdminActionResult {
  logger.error(`Admin action failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message }
}

export async function reviewReportAction(
  reportId: string,
  note?: string,
): Promise<AdminActionResult> {
  const parsed = reportInputSchema.safeParse({ reportId, note })

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(null).message }
  }

  try {
    await reviewReport(parsed.data.reportId, parsed.data.note)
    return { ok: true, error: null }
  } catch (error) {
    return failure('reviewReport', error)
  }
}

export async function resolveReportAction(
  reportId: string,
  note?: string,
): Promise<AdminActionResult> {
  const parsed = reportInputSchema.safeParse({ reportId, note })

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(null).message }
  }

  try {
    await resolveReport(parsed.data.reportId, parsed.data.note)
    return { ok: true, error: null }
  } catch (error) {
    return failure('resolveReport', error)
  }
}

export async function suspendUserAction(
  userId: string,
): Promise<AdminActionResult> {
  const parsed = userInputSchema.safeParse({ userId })

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(null).message }
  }

  try {
    await suspendUser(parsed.data.userId)
    return { ok: true, error: null }
  } catch (error) {
    return failure('suspendUser', error)
  }
}

export async function unsuspendUserAction(
  userId: string,
): Promise<AdminActionResult> {
  const parsed = userInputSchema.safeParse({ userId })

  if (!parsed.success) {
    return { ok: false, error: toErrorPayload(null).message }
  }

  try {
    await unsuspendUser(parsed.data.userId)
    return { ok: true, error: null }
  } catch (error) {
    return failure('unsuspendUser', error)
  }
}

// ─── Read actions (admin console) ─────────────────────────────
// Read paths throw AppError on failure so the calling page renders its
// error state; only the dashboard tray swallows failures (→ "—").

const queueFilterSchema = z
  .object({
    status: z.enum(['open', 'reviewed', 'actioned']).optional().nullable(),
    limit: z.number().int().min(1).max(250).optional(),
  })
  .strict()

export async function getReportQueueAction(
  status?: string | null,
  limit?: number,
): Promise<ReportQueueItemDTO[]> {
  const parsed = queueFilterSchema.safeParse({
    status: status ?? undefined,
    limit,
  })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That report filter is not valid.',
    )
  }

  return getReportQueue(parsed.data.status ?? undefined, parsed.data.limit)
}

const pageSchema = z
  .object({
    cursor: z.string().max(300).nullable().optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  })
  .strict()

export interface AdminUsersPage {
  items: AdminUserRowDTO[]
  nextCursor: string | null
}

export async function getAdminUsersAction(
  cursor?: string | null,
  pageSize?: number,
): Promise<AdminUsersPage> {
  const parsed = pageSchema.safeParse({ cursor: cursor ?? null, pageSize })

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That page is not valid.')
  }

  return getAdminUsers(parsed.data.cursor ?? null, parsed.data.pageSize)
}

export interface AdminEventsPage {
  items: AdminEventRowDTO[]
  nextCursor: string | null
}

export async function getAdminEventsAction(
  cursor?: string | null,
  pageSize?: number,
): Promise<AdminEventsPage> {
  const parsed = pageSchema.safeParse({ cursor: cursor ?? null, pageSize })

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That page is not valid.')
  }

  return getAdminEvents(parsed.data.cursor ?? null, parsed.data.pageSize)
}

const auditSchema = z
  .object({ limit: z.number().int().min(1).max(100).optional() })
  .strict()

export async function getAdminAuditLogsAction(
  limit?: number,
): Promise<AdminAuditLogDTO[]> {
  const parsed = auditSchema.safeParse({ limit })

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That audit page is not valid.')
  }

  return getAdminAuditLogs(parsed.data.limit)
}

export interface AdminDashboardStats {
  openReports: number | null
  flaggedThisWeek: number | null
  suspendedUsers: number | null
}

/**
 * Dashboard tray numbers, capped to 2 cheap reads:
 *  1. `getReportQueue()` (all statuses, capped) — open count + this-week
 *     reports count (best-effort proxy for "flagged this week").
 *  2. `getAdminUsers()` first page — suspended count within the page cap.
 * Failures are swallowed and returned as `null` so the tray renders "—"
 * instead of erroring the whole console page.
 */
const STATS_QUEUE_CAP = 250
const STATS_USERS_CAP = 100
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function getAdminDashboardStatsAction(): Promise<AdminDashboardStats> {
  try {
    const [queue, usersPage] = await Promise.all([
      getReportQueue(undefined, STATS_QUEUE_CAP),
      getAdminUsers(null, STATS_USERS_CAP),
    ])

    const weekCutoff = Date.now() - WEEK_MS

    return {
      openReports: queue.filter((item) => item.status === 'open').length,
      flaggedThisWeek: queue.filter(
        (item) => Date.parse(item.createdAt) >= weekCutoff,
      ).length,
      suspendedUsers: usersPage.items.filter((item) => item.isSuspended).length,
    }
  } catch (error) {
    logger.error('getAdminDashboardStats: read failed', { error })
    return { openReports: null, flaggedThisWeek: null, suspendedUsers: null }
  }
}
