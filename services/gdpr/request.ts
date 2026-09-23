// src/services/gdpr/request.ts
// Shared helper for requestExportJob / requestEraseJob: both follow the
// identical idempotent-upsert pattern (check pending → insert → audit →
// funnel → return). The only variance is request_type + error/audit/funnel
// copy, which are parameterised here so the business logic lives in one place.
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { writeAuditLog, type AuditAction } from '@/lib/audit'
import { trackFunnel, type FunnelEventName } from '@/lib/analytics/funnel'

export interface GdprJobRequest {
  requestId: string
  alreadyPending: boolean
}

export interface RequestGdprJobParams {
  userId: string
  requestType: 'export' | 'erase'
  action: AuditAction
  eventName: FunnelEventName
  errorMessage: string
  logPrefix: string
}

/**
 * Create a pending GDPR request row (export or erase) for a user.
 * Idempotent via the partial unique index on (user_id, request_type, 'pending').
 */
export async function requestGdprJob(
  params: RequestGdprJobParams,
): Promise<GdprJobRequest> {
  const { userId, requestType, action, eventName, errorMessage, logPrefix } =
    params

  const supabase = await createServerSupabaseClient()

  const { data: existing, error: checkError } = await supabase
    .from('export_requests')
    .select('id, status')
    .eq('user_id', userId)
    .eq('request_type', requestType)
    .eq('status', 'pending')
    .maybeSingle()

  if (checkError && checkError.code !== 'PGRST116') {
    logger.error(`${logPrefix}: check pending failed`, {
      userId,
      error: checkError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, errorMessage, {
      cause: checkError,
    })
  }
  if (existing) {
    return {
      requestId: String(existing.id),
      alreadyPending: true,
    }
  }

  const { data, error } = await supabase
    .from('export_requests')
    .insert({
      user_id: userId,
      status: 'pending',
      request_type: requestType,
    })
    .select('id')
    .single()

  if (error) {
    logger.error(`${logPrefix}: create failed`, {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, errorMessage, {
      cause: error,
    })
  }

  await writeAuditLog({
    actorId: userId,
    actorType: 'user',
    action,
    entityType: 'export_request',
    entityId: String(data.id),
  })
  await trackFunnel({
    eventName,
    actorId: userId,
    entityType: 'export_request',
    entityId: String(data.id),
    result: 'pending',
  })

  logger.info(`${logPrefix} request created`, {
    requestId: data.id,
    userId,
  })

  return {
    requestId: String(data.id),
    alreadyPending: false,
  }
}
