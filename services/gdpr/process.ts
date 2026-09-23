// src/services/gdpr/process.ts
// #17 — The worker determines the operation solely from durable DB state
// (export_requests.request_type), never from the caller-supplied body.
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { processExportJob } from '@/services/gdpr/export'
import { processEraseJob } from '@/services/gdpr/erase'

/** Dispatch a pending GDPR job by its persisted request_type. */
export async function processGdprJob(requestId: string): Promise<{
  requestId: string
  type: 'export' | 'erase'
  fulfilled: boolean
}> {
  const admin = getAdminSupabaseClient()
  const { data: row, error } = await admin
    .from('export_requests')
    .select('id, request_type')
    .eq('id', requestId)
    .maybeSingle()

  if (error) {
    logger.error('GDPR job dispatch: lookup failed', {
      requestId,
      error: error.message,
    })
    throw error
  }
  if (!row) {
    throw Object.assign(new Error(`GDPR job not found: ${requestId}`), {
      statusCode: 404,
    })
  }

  if (row.request_type === 'erase') {
    const res = await processEraseJob(requestId)
    return { ...res, type: 'erase' }
  }
  if (row.request_type === 'export') {
    const res = await processExportJob(requestId)
    return { ...res, type: 'export' }
  }

  // Unknown persisted request_type — fail closed, never fake success. This is
  // a data/contract defect that must surface (worker → 500) and block the row
  // from being marked fulfilled, not silently return a "processed" 200 that
  // leaves the job stuck pending forever (#16 terminal-state requirement).
  logger.error('GDPR job has unknown request_type', {
    requestId,
    type: row.request_type,
  })
  throw Object.assign(new Error(`Unknown GDPR request_type: ${requestId}`), {
    statusCode: 500,
  })
}
