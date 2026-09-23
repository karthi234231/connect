import {
  getAdminAuditLogsAction,
  getAdminDashboardStatsAction,
  getAdminEventsAction,
  getAdminUsersAction,
  getReportQueueAction,
  resolveReportAction,
  reviewReportAction,
  suspendUserAction,
  unsuspendUserAction,
  type AdminDashboardStats,
  type AdminEventsPage,
  type AdminUsersPage,
} from '@/app/actions/admin'
import type { AdminAuditLogDTO, ReportQueueItemDTO } from '@/lib/dto-admin'

export async function fetchReportQueue(
  status?: string | null,
  limit?: number,
): Promise<ReportQueueItemDTO[]> {
  return getReportQueueAction(status, limit)
}

export async function fetchAdminUsers(
  cursor?: string | null,
  pageSize?: number,
): Promise<AdminUsersPage> {
  return getAdminUsersAction(cursor, pageSize)
}

export async function fetchAdminEvents(
  cursor?: string | null,
  pageSize?: number,
): Promise<AdminEventsPage> {
  return getAdminEventsAction(cursor, pageSize)
}

export async function fetchAdminAuditLogs(
  limit?: number,
): Promise<AdminAuditLogDTO[]> {
  return getAdminAuditLogsAction(limit)
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  return getAdminDashboardStatsAction()
}

async function ensureOk(result: {
  ok: boolean
  error: string | null
}): Promise<void> {
  if (!result.ok)
    throw new Error(result.error ?? 'That action could not be completed.')
}

export async function reviewReport(
  reportId: string,
  note?: string,
): Promise<void> {
  await ensureOk(await reviewReportAction(reportId, note))
}

export async function resolveReport(
  reportId: string,
  note?: string,
): Promise<void> {
  await ensureOk(await resolveReportAction(reportId, note))
}

export async function suspendUser(userId: string): Promise<void> {
  await ensureOk(await suspendUserAction(userId))
}

export async function unsuspendUser(userId: string): Promise<void> {
  await ensureOk(await unsuspendUserAction(userId))
}
