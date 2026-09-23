// src/app/api/gdpr/export/route.ts
// POST /api/gdpr/export — request an async data-export job. The user receives
// an email with a signed download link once processing completes. The same
// server action (requestExportJob) is used by the Privacy settings UI.

import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes, apiError, apiOk } from '@/lib/errors'
import { requestExportJob } from '@/services/gdpr/export'

async function handlePost(session: import('@/lib/auth').CurrentSession) {
  try {
    const result = await requestExportJob(session.userId)

    return NextResponse.json(apiOk(result))
  } catch (error) {
    logger.error('GDPR export API failed', { userId: session.userId, error })

    return NextResponse.json(
      apiError(
        error instanceof AppError ? error.code : ErrorCodes.INTERNAL,
        'Unable to request data export.',
      ),
      { status: 500 },
    )
  }
}

export const POST = withAuth(handlePost)
