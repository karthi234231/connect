// src/app/api/gdpr/erase/route.ts
// POST /api/gdpr/erase — request account deletion. Same server action
// (requestEraseJob) used by the Account danger zone and Privacy settings.

import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes, apiError, apiOk } from '@/lib/errors'
import { requestEraseJob } from '@/services/gdpr/erase'

async function handlePost(session: import('@/lib/auth').CurrentSession) {
  try {
    const result = await requestEraseJob(session.userId)
    return NextResponse.json(apiOk(result))
  } catch (error) {
    logger.error('GDPR erase API failed', { userId: session.userId, error })
    return NextResponse.json(
      apiError(
        error instanceof AppError ? error.code : ErrorCodes.INTERNAL,
        'Unable to request account deletion.',
      ),
      { status: 500 },
    )
  }
}

export const POST = withAuth(handlePost)
