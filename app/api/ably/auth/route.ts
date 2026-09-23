import { NextRequest, NextResponse } from 'next/server'

import { getAblyTokenAction } from '@/app/actions/chat'
import { getRequestId } from '@/lib/auth'
import { AppError, ErrorCodes, apiError, apiOk } from '@/lib/errors'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const headers = { 'x-request-id': requestId ?? '' }

  try {
    const body = (await request.json()) as { matchId?: unknown }
    if (typeof body.matchId !== 'string' || !body.matchId) {
      return NextResponse.json(
        apiError(ErrorCodes.VALIDATION, 'matchId is required.', requestId),
        { status: 400, headers },
      )
    }

    const result = await getAblyTokenAction({ matchId: body.matchId })
    return NextResponse.json(apiOk(result), { headers })
  } catch (error: unknown) {
    const code =
      error instanceof AppError ? error.code : ErrorCodes.UNAUTHENTICATED
    const message =
      error instanceof AppError
        ? error.message
        : 'Failed to generate chat token.'
    return NextResponse.json(apiError(code, message, requestId), {
      status:
        error instanceof AppError && code === ErrorCodes.UNAUTHENTICATED
          ? 401
          : 500,
      headers,
    })
  }
}
