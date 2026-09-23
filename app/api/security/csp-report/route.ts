import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getRequestId } from '@/lib/auth'
import { apiError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  checkRateLimit,
  authIpRatelimit,
  getRateLimitHeaders,
} from '@/lib/ratelimit'
import { logCspViolation } from '@/lib/security'

const MAX_REPORT_BYTES = 20_000
const reportSchema = z
  .object({
    type: z.string().optional(),
    'csp-report': z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown())

function requestIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function methodNotAllowed() {
  return NextResponse.json(
    apiError(ErrorCodes.VALIDATION, 'Method not allowed'),
    { status: 405, headers: { Allow: 'POST' } },
  )
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(
    `guest:${requestIp(request)}:csp-report`,
    authIpRatelimit,
  )
  if (!rateLimit.success) {
    return NextResponse.json(
      apiError(ErrorCodes.RATE_LIMITED, 'Too many reports. Please slow down.'),
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit, true),
      },
    )
  }

  const raw = await request.text()
  logger.warn('CSP report body received', { length: raw.length })
  if (Buffer.byteLength(raw, 'utf8') > MAX_REPORT_BYTES) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'CSP report is too large'),
      { status: 413 },
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Invalid CSP report'),
      { status: 400 },
    )
  }

  const report = reportSchema.safeParse(parsed)
  if (!report.success) {
    return NextResponse.json(
      apiError(ErrorCodes.VALIDATION, 'Invalid CSP report'),
      { status: 400 },
    )
  }

  logCspViolation(report.data)
  return new NextResponse(null, {
    status: 204,
    headers: { 'x-request-id': getRequestId(request) ?? '' },
  })
}

export function GET() {
  return methodNotAllowed()
}

export function PUT() {
  return methodNotAllowed()
}

export function DELETE() {
  return methodNotAllowed()
}

export function PATCH() {
  return methodNotAllowed()
}

export function HEAD() {
  return methodNotAllowed()
}

export function OPTIONS() {
  return methodNotAllowed()
}
