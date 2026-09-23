// src/lib/audit.ts
// ─────────────────────────────────────────────────────────────────────────────
// Canonical audit logging.
//
// Writes append-only audit records to `audit_logs` through the service-role
// client. User-visible metadata is redacted before persistence.
// `formatAuditEntry` remains pure and unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { runTask } from '@/lib/tasks'
import { randomUUID } from 'crypto'

export const AuditActions = {
  ReportSubmitted: 'report.submitted',
  ReportReviewed: 'report.reviewed',
  ReportResolved: 'report.resolved',
  ReportBulkModerated: 'report.bulk_moderated',
  UserSuspended: 'user.suspended',
  UserUnsuspended: 'user.unsuspended',
  GdprExportRequested: 'gdpr.export_requested',
  GdprExportFulfilled: 'gdpr.export_fulfilled',
  GdprEraseRequested: 'gdpr.erase_requested',
  IdeaIdentityRevealed: 'idea.identity_revealed',
  UserBlocked: 'user.blocked',
} as const

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions]

/** #180 — actor type distinguishes user, admin, system, and worker actions. */
export type ActorType = 'user' | 'admin' | 'system' | 'worker'

export interface AuditInput {
  actorId: string
  /** #180 — who or what performed the action. */
  actorType?: ActorType
  action: AuditAction
  entityType: string
  entityId?: string
  note?: string
  metadata?: Record<string, unknown>
  /** #159 — request correlation ID for tracing across services. */
  correlationId?: string
}

export function formatAuditEntry(input: AuditInput): string {
  const parts = [`actor=${input.actorId}`]

  if (input.actorType) {
    parts.push(`actor_type=${input.actorType}`)
  }

  parts.push(`action=${input.action}`, `entity=${input.entityType}`)

  if (input.entityId) {
    parts.push(`id=${input.entityId}`)
  }

  if (input.correlationId) {
    parts.push(`correlation=${input.correlationId}`)
  }

  if (input.note) {
    parts.push(`note=${input.note}`)
  }

  if (input.metadata) {
    parts.push(`meta=${JSON.stringify(redactMeta(input.metadata))}`)
  }

  return parts.join(' ')
}

const SENSITIVE_KEYS = [
  'email',
  'phone',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
] as const

function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(meta)) {
    out[key] = SENSITIVE_KEYS.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey),
    )
      ? '[REDACTED]'
      : value
  }

  return out
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const admin = getAdminSupabaseClient()
  const correlationId = input.correlationId ?? randomUUID()
  const enrichedInput = { ...input, correlationId }
  const line = formatAuditEntry(enrichedInput)

  if (!admin) {
    logger.warn('Audit log not written (admin client unavailable)', {
      auditLine: line,
    })
    return
  }

  await runTask(
    async () => {
      const metadata = {
        ...(input.actorType ? { actor_type: input.actorType } : {}),
        ...(input.metadata ? redactMeta(input.metadata) : {}),
        ...(input.note ? { note: input.note } : {}),
        correlation_id: correlationId,
      }

      const { error } = await admin.from('audit_logs').insert({
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        metadata,
      })

      if (error) {
        throw new Error(`audit insert failed: ${error.message}`)
      }
    },
    {
      id: `audit-${input.action}-${input.entityId ?? '?'}`,
      context: { auditLine: line, correlationId },
      retry: true,
    },
  )
}
