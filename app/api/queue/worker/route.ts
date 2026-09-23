// src/app/api/queue/worker/route.ts
// #17 / HOST-ASYNC-03 / HOST-ASYNC-04 — the single machine-authenticated worker
// entrypoint (ADR-001: background work runs inline or on pg_cron, never a queue
// broker). Authentication is the shared WORKER_SECRET bearer token, NOT a human
// session, so the caller is infrastructure (pg_cron / curl from the scheduler).
import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { getRequestId } from '@/lib/auth'
import { apiError, apiOk, ErrorCodes, type ErrorCode } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { safeCompare } from '@/lib/security'
import { flushAnalyticsBuffer } from '@/lib/analytics/flush'
import { processSlackAlerts } from '@/services/alerts/slack-outbox'
import { processGdprJob } from '@/services/gdpr/process'
import { processNotificationDeliveries } from '@/services/notifications/notifications.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  requestId?: string,
) {
  return NextResponse.json(apiError(code, message, requestId), {
    status,
    headers: { 'x-request-id': requestId ?? '' },
  })
}

export function isAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? ''
  const secret = env.WORKER_SECRET

  if (!secret) {
    return false
  }

  return safeCompare(header, `Bearer ${secret}`)
}

interface WorkerBody {
  task?: unknown
  requestId?: unknown
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  if (!isAuthorized(request)) {
    return errorResponse(
      ErrorCodes.UNAUTHENTICATED,
      'Unauthorized',
      401,
      requestId,
    )
  }

  let body: WorkerBody

  try {
    body = (await request.json()) as WorkerBody
  } catch {
    return errorResponse(
      ErrorCodes.VALIDATION,
      'Invalid JSON body',
      400,
      requestId,
    )
  }

  // ── GDPR job drain (requestId-scoped) ──────────────────────────────────
  if (typeof body.requestId === 'string') {
    if (!UUID_RE.test(body.requestId)) {
      return errorResponse(
        ErrorCodes.VALIDATION,
        'Invalid requestId',
        400,
        requestId,
      )
    }

    try {
      const result = await processGdprJob(body.requestId)

      return NextResponse.json(
        apiOk({
          processed: true,
          requestId: result.requestId,
          type: result.type,
          fulfilled: result.fulfilled,
        }),
        {
          headers: { 'x-request-id': requestId ?? '' },
        },
      )
    } catch (error) {
      logger.error('Worker: GDPR job failed', {
        requestId: body.requestId,
        error,
      })

      return errorResponse(
        ErrorCodes.INTERNAL,
        'GDPR job failed',
        500,
        requestId,
      )
    }
  }

  // ── Task dispatch ──────────────────────────────────────────────────────
  const task = typeof body.task === 'string' ? body.task : null

  if (!task) {
    return errorResponse(
      ErrorCodes.VALIDATION,
      'Provide `task` or `requestId`',
      400,
      requestId,
    )
  }

  try {
    switch (task) {
      case 'notification-deliveries': {
        const result = await processNotificationDeliveries()
        return NextResponse.json(apiOk(result), {
          headers: { 'x-request-id': requestId ?? '' },
        })
      }

      case 'slack-alerts': {
        const result = await processSlackAlerts()
        return NextResponse.json(apiOk(result), {
          headers: { 'x-request-id': requestId ?? '' },
        })
      }

      case 'analytics-flush': {
        const flushed = await flushAnalyticsBuffer()
        return NextResponse.json(apiOk({ task, flushed }), {
          headers: { 'x-request-id': requestId ?? '' },
        })
      }

      default:
        return errorResponse(
          ErrorCodes.VALIDATION,
          `Unknown task: ${task}`,
          400,
          requestId,
        )
    }
  } catch (error) {
    logger.error('Worker: task failed', { task, error })

    return errorResponse(ErrorCodes.INTERNAL, 'Task failed', 500, requestId)
  }
}
