// src/services/gdpr/export.ts
// W5.2/S6 + #16 — GDPR export as a trackable, *retrievable* job.
//
// `requestExportJob` creates a pending `export_requests` row (idempotent via the
// partial unique index). The worker (see /api/queue/worker) calls
// `processExportJob`, which generates a registry-driven payload across every
// user-keyed table, stores it as a JSON artifact in the PRIVATE gdpr-exports
// bucket, persists metadata (object_key/checksum/size/expires) and marks the
// row fulfilled. The user downloads via GET /api/gdpr/export → signed URL.
import { createHash } from 'node:crypto'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { writeAuditLog, AuditActions } from '@/lib/audit'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import { requestGdprJob } from './request'

/** How long the stored artifact remains downloadable. */
const EXPORT_TTL_DAYS = 7

/** Create a pending export request for a user (idempotent). */
export async function requestExportJob(userId: string): Promise<{
  requestId: string
  alreadyPending: boolean
}> {
  return requestGdprJob({
    userId,
    requestType: 'export',
    action: AuditActions.GdprExportRequested,
    eventName: FunnelEvents.GdprExportRequested,
    errorMessage: 'Failed to request export',
    logPrefix: 'GDPR export',
  })
}

/** Tables included in a user's export: { table, userRef? }.
 *  No userRef = self-keyed table (profiles.id / export_requests.user_id etc.). */
const EXPORT_TABLES: ReadonlyArray<{ table: string; userRef?: string }> = [
  { table: 'profiles' },
  { table: 'user_skills' },
  { table: 'matches', userRef: 'user1_id,user2_id' },
  { table: 'messages', userRef: 'sender_id' },
  { table: 'blocks', userRef: 'blocker_id' },
  { table: 'reports', userRef: 'reporter_id' },
  { table: 'events', userRef: 'organizer_id' },
  { table: 'event_attendees', userRef: 'user_id' },
  { table: 'event_registrations', userRef: 'user_id' },
  { table: 'event_registration_idempotency', userRef: 'user_id' },
  { table: 'feedback', userRef: 'user_id' },
  { table: 'idea_interests', userRef: 'user_id' },
  { table: 'ideas', userRef: 'owner_id' },
  { table: 'join_requests', userRef: 'user_id' },
  { table: 'match_timeline', userRef: 'user_id' },
  { table: 'notification_preferences', userRef: 'user_id' },
  { table: 'notification_settings', userRef: 'user_id' },
  { table: 'notifications', userRef: 'user_id' },
  { table: 'recommendations', userRef: 'user_id' },
  { table: 'device_subscriptions', userRef: 'user_id' },
  { table: 'export_requests', userRef: 'user_id' },
  { table: 'audit_logs', userRef: 'actor_id' },
]

type ExportPayload = {
  generated_at: string
  tables: Record<string, unknown[] | null>
}

/** Generate the export payload for a user across the full table registry.
 *  A per-table failure is non-fatal (recorded as null) so one broken table
 *  can never void the whole export. */
type LooseQuery = PromiseLike<{
  data: unknown
  error: { message: string; code?: string } | null
}> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  or: (filters: string) => LooseQuery
  update: (values: unknown) => LooseQuery
}

type LooseTable = {
  from: (table: string) => LooseQuery
}

export async function generateExport(userId: string): Promise<ExportPayload> {
  const db = getAdminSupabaseClient() as unknown as LooseTable
  const tables: Record<string, unknown[] | null> = {}

  await Promise.all(
    EXPORT_TABLES.map(async ({ table, userRef }) => {
      let query = db.from(table).select('*')
      if (userRef) {
        const cols = userRef.split(',')
        query = query.or(cols.map((c: string) => `${c}.eq.${userId}`).join(','))
      } else {
        query = query.eq('id', userId)
      }
      const { data, error } = await query
      tables[table] = error ? null : ((data ?? []) as unknown[])
      if (error) {
        logger.warn('GDPR export: table fetch failed', {
          table,
          userId,
          error: error.message,
        })
      }
    }),
  )

  return { generated_at: new Date().toISOString(), tables }
}

/** Upload the artifact to the private gdpr-exports bucket and persist metadata. */
async function storeArtifact(
  userId: string,
  requestId: string,
  payload: ExportPayload,
) {
  const admin = getAdminSupabaseClient()
  const body = JSON.stringify(payload, null, 2)
  const objectKey = `${userId}/${requestId}.json`

  const { error: upErr } = await admin.storage
    .from('gdpr-exports')
    .upload(objectKey, body, {
      contentType: 'application/json',
      upsert: true, // retries of the same job replace, never duplicate
    })
  if (upErr) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to store export artifact', {
      cause: upErr,
    })
  }

  const checksum = createHash('sha256').update(body).digest('hex')
  const expiresAt = new Date(
    Date.now() + EXPORT_TTL_DAYS * 86400_000,
  ).toISOString()

  const { error: metaErr } = await (admin as unknown as LooseTable)
    .from('export_requests')
    .update({
      object_key: objectKey,
      checksum,
      size_bytes: body.length,
      expires_at: expiresAt,
    })
    .eq('id', requestId)
  if (metaErr) {
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to persist export metadata',
      { cause: metaErr },
    )
  }
}

/** Return a short-lived signed URL for the user's fulfilled export, or null. */
export async function getExportDownload(
  requestId: string,
  userId: string,
): Promise<{ url: string; expiresAt: string | null } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: row } = await supabase
    .from('export_requests')
    .select('object_key, status, expires_at')
    .eq('id', requestId)
    .eq('user_id', userId)
    .maybeSingle()

  // RLS already scopes to owner; the explicit status check avoids signing URLs
  // for unfulfilled rows whose object_key may be stale from a prior attempt.
  if (!row || row.status !== 'fulfilled' || !row.object_key) return null
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin.storage
    .from('gdpr-exports')
    .createSignedUrl(row.object_key, 300)
  if (error || !data) {
    logger.error('GDPR export: signed URL failed', {
      requestId,
      error: error?.message,
    })
    return null
  }
  return { url: data.signedUrl, expiresAt: row.expires_at }
}

/**
 * Fulfil a pending export request: generate the payload, mark the row
 * fulfilled and emit audit + funnel. Called by the queue worker.
 */
export async function processExportJob(requestId: string): Promise<{
  requestId: string
  fulfilled: boolean
}> {
  const admin = getAdminSupabaseClient()

  const { data: request, error: reqError } = await admin
    .from('export_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single()

  if (reqError || !request) {
    logger.error('GDPR export job: request not found', { requestId })
    throw AppError.notFound('Export request', requestId)
  }
  if (request.status === 'fulfilled') {
    return { requestId, fulfilled: true }
  }

  // Generate + persist the artifact (throws on failure → job left pending for retry).
  await storeArtifact(
    String(request.user_id),
    requestId,
    await generateExport(String(request.user_id)),
  )

  const { error } = await admin
    .from('export_requests')
    .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) {
    logger.error('GDPR export job: fulfilment update failed', {
      requestId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fulfil export request', {
      cause: error,
    })
  }

  await writeAuditLog({
    actorId: String(request.user_id),
    actorType: 'worker',
    action: AuditActions.GdprExportFulfilled,
    entityType: 'export_request',
    entityId: requestId,
  })
  await trackFunnel({
    eventName: FunnelEvents.GdprExportRequested,
    actorId: String(request.user_id),
    entityType: 'export_request',
    entityId: requestId,
    result: 'fulfilled',
  })

  logger.info('GDPR export request fulfilled', {
    requestId,
    userId: request.user_id,
  })
  return { requestId, fulfilled: true }
}
