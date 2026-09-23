// src/services/gdpr/erase.ts
// W5.2/S6 — GDPR erase as a trackable job.
//
// `requestEraseJob` creates a pending erase request (reuses the export_requests
// table with a distinct status flow) and the queue worker fulfils it via
// `processEraseJob` → `hardErase`. Audit + funnel are emitted on both phases.
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { AuditActions } from '@/lib/audit'
import { FunnelEvents } from '@/lib/analytics/funnel'
import { requestGdprJob } from './request'

/** Create a pending erase request for a user (idempotent). */
export async function requestEraseJob(userId: string): Promise<{
  requestId: string
  alreadyPending: boolean
}> {
  return requestGdprJob({
    userId,
    requestType: 'erase',
    action: AuditActions.GdprEraseRequested,
    eventName: FunnelEvents.GdprEraseRequested,
    errorMessage: 'Failed to request erasure',
    logPrefix: 'GDPR erase',
  })
}

/**
 * Hard-delete all of a user's data + auth account via atomic DB RPC.
 *
 * Phased flow (HOST-DB-03 fix):
 *  1. Best-effort storage cleanup (match-attachments + avatars)
 *  2. RPC erases DB rows but leaves status=processing (p_mark_completed=false)
 *  3. Delete the auth account
 *  4. Mark the job completed (terminal state)
 *
 * If the process crashes between steps 2–4, the job stays in 'processing' and
 * the next worker invocation re-enters hardErase, which is safe because all
 * DB deletes are idempotent.
 */
export async function hardErase(userId: string, requestId: string) {
  const admin = getAdminSupabaseClient()

  // 1. Best-effort storage cleanup (storage.protect_delete blocks direct SQL
  //    DELETEs; only the Storage API can remove objects). Wrapped so a storage
  //    failure never blocks the erasure itself.
  await bestEffortStorageCleanup(admin, userId)

  // 2. Atomic DB erasure. Pass p_mark_completed=false so the RPC stops at
  //    'processing' — the app layer owns the terminal state transition.
  const { data, error } = await admin.rpc('sp_hard_erase_user', {
    p_user_id: userId,
    p_request_id: requestId,
    p_mark_completed: false,
  })

  if (error) {
    logger.error('GDPR hard erase RPC failed', {
      userId,
      requestId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to erase user data', {
      cause: error,
    })
  }

  const result = (data ?? null) as {
    ok?: boolean
    reason?: string
    request_id?: string
    rows_removed?: number
  } | null

  if (!result?.ok) {
    const reason = result?.reason ?? 'unknown'
    // A no-op (request already claimed/missing) is not an error.
    if (reason !== 'request_not_found' && reason !== 'already_processing') {
      logger.error('GDPR hard erase did not complete', {
        userId,
        requestId,
        reason,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to erase user data')
    }
    logger.warn('GDPR hard erase no-op', { userId, requestId, reason })
    return
  }

  // 3. Delete the auth account. If this fails the job stays in 'processing'
  //    and will be retried by the worker — the auth account is not stranded.
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    logger.error('Failed to hard erase auth user — will retry', {
      userId,
      requestId,
      error: authError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to erase auth account', {
      cause: authError,
    })
  }

  // 4. Mark job completed (durable terminal state, #21).
  const { error: completeError } = await admin
    .from('export_requests')
    .update({ status: 'completed', fulfilled_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'processing')

  if (completeError) {
    logger.error('Failed to mark erase job completed', {
      userId,
      requestId,
      error: completeError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to finalize erase job')
  }

  logger.info('Hard erasure completed', {
    userId,
    requestId,
    rowsRemoved: result.rows_removed,
  })
}

/**
 * Remove a user's storage objects from known buckets (best-effort).
 *
 * Avatars: objects are under `{userId}/{name}` — straightforward prefix list.
 * Match-attachments: objects are under `{matchId}/{uuid}.{ext}` — the
 * matchId is NOT the userId, so we query the matches table for all match
 * IDs involving this user before the DB wipe clears them (HOST-DB-04 fix).
 *
 * Both buckets paginate until exhaustion (HOST-DB-05 fix).
 */
async function bestEffortStorageCleanup(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  userId: string,
) {
  const PAGE_SIZE = 500

  // ── Avatars: objects are stored under the user's own ID prefix ────────
  await removeBucketPages(admin, 'avatars', userId, PAGE_SIZE)

  // ── Match-attachments: objects are stored under each match ID ─────────
  // Query match IDs before the DB erase wipes the matches table.
  // Use the admin client to bypass RLS.
  try {
    const { data: matchRows } = await admin
      .from('matches')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    const matchIds = (matchRows ?? []).map((r: { id: string }) => r.id)
    if (matchIds.length === 0) {
      return
    }

    for (const matchId of matchIds) {
      await removeBucketPages(admin, 'match-attachments', matchId, PAGE_SIZE)
    }
  } catch (err) {
    logger.warn('GDPR match-attachment cleanup query failed', {
      userId,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}

/**
 * Paginate through all objects under `prefix` in `bucket` and remove them.
 * S50 — unbounded: loops until a short page arrives. There is deliberately NO
 * page-count hard stop: a 500-object / N-page cap would silently retain
 * erased users' data past the cut.
 */
async function removeBucketPages(
  admin: ReturnType<typeof getAdminSupabaseClient>,
  bucket: string,
  prefix: string,
  pageSize: number,
) {
  let offset = 0

  for (;;) {
    try {
      const { data: objects, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: pageSize, offset })
      if (error || !objects || objects.length === 0) {
        break
      }

      const paths = objects
        .filter((o) => 'id' in o) // skip folder summaries
        .map((o) => `${prefix}/${o.name}`)

      if (paths.length > 0) {
        await admin.storage.from(bucket).remove(paths)
      }

      // Fewer than pageSize means we've reached the end.
      if (objects.length < pageSize) {
        break
      }
      offset += pageSize
    } catch (err) {
      logger.warn('GDPR storage cleanup page failed', {
        bucket,
        prefix,
        offset,
        error: err instanceof Error ? err.message : 'unknown',
      })
      break
    }
  }
}

/**
 * Fulfil a pending erase request: run hard erase (atomic DB RPC) + auth
 * deletion in a phased flow. Called by the queue worker.
 *
 * Idempotent:
 *  - completed/fulfilled → no-op
 *  - processing → retry (DB deletes are idempotent; auth deletion may have
 *    been the step that failed last time)
 *  - pending → full flow
 */
export async function processEraseJob(requestId: string): Promise<{
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
    logger.error('GDPR erase job: request not found', { requestId })
    throw AppError.notFound('Erase request', requestId)
  }

  // Durable terminal states need no further work (#19/#21).
  if (request.status === 'completed' || request.status === 'fulfilled') {
    return { requestId, fulfilled: true }
  }

  // processing: DB erase was committed but auth deletion may have failed or
  // the process crashed. Re-enter hardErase — all DB deletes are idempotent.
  if (request.status === 'processing') {
    logger.info('GDPR erase job retrying from processing state', { requestId })
  }

  if (!request.user_id) {
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Erase request missing user reference',
    )
  }

  await hardErase(String(request.user_id), requestId)
  return { requestId, fulfilled: true }
}
