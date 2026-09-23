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

export interface SystemHealthCheck {
  name: string
  status: 'ok' | 'degraded' | 'skipped' | 'error'
  latencyMs: number
  detail?: string
}

export interface SystemHealthData {
  status: 'ready' | 'not_ready'
  environment: string
  timestamp: string
  config: {
    valid: boolean
    issueCount: number
  }
  checks: SystemHealthCheck[]
}

export async function fetchSystemHealth(): Promise<SystemHealthData> {
  try {
    const res = await fetch('/api/health/ready', { cache: 'no-store' })
    if (res.ok || res.status === 503) {
      return (await res.json()) as SystemHealthData
    }
    throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    return {
      status: 'not_ready',
      environment: process.env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      config: { valid: false, issueCount: 1 },
      checks: [
        {
          name: 'system-readiness',
          status: 'error',
          latencyMs: 0,
          detail: error instanceof Error ? error.message : 'Probe connection failed',
        },
      ],
    }
  }
}

