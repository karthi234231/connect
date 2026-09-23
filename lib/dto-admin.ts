import { z } from 'zod'

export interface AdminProfileRow {
  id: string
  full_name: string
  role?: string | null
  created_at?: string | null
  last_active_at?: string | null
  suspended_at?: string | null
  report_count?: number
}

export const AdminUserRowDTOSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string(),
    role: z.string().nullable(),
    createdAt: z.string().nullable(),
    lastActiveAt: z.string().nullable(),
    isSuspended: z.boolean(),
    reportCount: z.number().int().nonnegative(),
  })
  .strict()

export type AdminUserRowDTO = z.infer<typeof AdminUserRowDTOSchema>

export function toAdminUserRowDTO(row: AdminProfileRow): AdminUserRowDTO {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role ?? null,
    createdAt: row.created_at ?? null,
    lastActiveAt: row.last_active_at ?? null,
    isSuspended: Boolean(row.suspended_at),
    reportCount: row.report_count ?? 0,
  }
}

export interface ReportRow {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  note?: string | null
  status?: string | null
  created_at?: string | null
}

export const ReportQueueItemDTOSchema = z
  .object({
    id: z.string().uuid(),
    reporterId: z.string().uuid(),
    reportedId: z.string().uuid(),
    reason: z.string(),
    note: z.string().nullable(),
    status: z.enum(['open', 'reviewed', 'actioned']).nullable(),
    createdAt: z.string(),
  })
  .strict()

export type ReportQueueItemDTO = z.infer<typeof ReportQueueItemDTOSchema>

export function toReportQueueItemDTO(row: ReportRow): ReportQueueItemDTO {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedId: row.reported_id ?? '',
    reason: row.reason,
    note: row.note ?? null,
    status: (row.status as ReportQueueItemDTO['status']) ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
  }
}

// ─── Admin events (audit listing) ─────────────────────────────

export interface AdminEventRow {
  id: string
  title: string
  status: string
  visibility: string
  organizer_id: string
  starts_at: string
  created_at: string
  capacity: number
}

export const AdminEventRowDTOSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    visibility: z.string(),
    organizerId: z.string().uuid(),
    startsAt: z.string(),
    createdAt: z.string(),
    capacity: z.number().int().nonnegative(),
  })
  .strict()

export type AdminEventRowDTO = z.infer<typeof AdminEventRowDTOSchema>

export function toAdminEventRowDTO(row: AdminEventRow): AdminEventRowDTO {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    organizerId: row.organizer_id,
    startsAt: row.starts_at,
    createdAt: row.created_at,
    capacity: row.capacity ?? 0,
  }
}

// ─── Audit log rows (admin viewer, last N) ────────────────────

export interface AdminAuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export const AdminAuditLogDTOSchema = z
  .object({
    id: z.string().uuid(),
    actorId: z.string().nullable(),
    action: z.string(),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()

export type AdminAuditLogDTO = z.infer<typeof AdminAuditLogDTOSchema>

export function toAdminAuditLogDTO(row: AdminAuditLogRow): AdminAuditLogDTO {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
  }
}

// ─── Keyset cursor (pure, unit-tested) ─────────────────────────

export interface KeysetCursor {
  sortValue: string | null
  id: string | null
}

/** "createdAt|id" opaque token (matches the pattern in getAdminUsers). */
export function decodeKeysetCursor(
  cursor: string | null | undefined,
): KeysetCursor {
  if (!cursor) return { sortValue: null, id: null }
  const [sortValue, id] = cursor.split('|', 2)
  return { sortValue: sortValue || null, id: id || null }
}

export function encodeKeysetCursor(sortValue: string, id: string): string {
  return `${sortValue}|${id}`
}
