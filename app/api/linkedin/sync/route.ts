// src/app/api/linkedin/sync/route.ts
// POST /api/linkedin/sync — refresh the authenticated user's LinkedIn profile,
// experiences and education. The route assembles the full LinkedIn provider
// adapter from the live session's provider_token, runs the sync, and persists
// through the S07 seam. No secrets are emitted; the response is a bare JSON
// envelope.

import { NextResponse } from 'next/server'

import { withAuth, getRequestId } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { ErrorCodes, apiError, apiOk, type ErrorCode } from '@/lib/errors'

import {
  LinkedInApiClient,
  capabilitiesForSession,
  createLinkedInProvider,
  extractProviderMemberId,
  syncLinkedInProvider,
} from '@/services/linkedin'
import { createLinkedInPersistence } from '@/services/linkedin/persistence'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'

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

async function handlePost(
  session: import('@/lib/auth').CurrentSession,
  request: Request,
) {
  const requestId = getRequestId(request)
  try {
    const {
      data: { user },
    } = await session.supabase.auth.getUser()

    if (!user) {
      return errorResponse(
        ErrorCodes.UNAUTHENTICATED,
        'Authentication required.',
        401,
        requestId,
      )
    }

    const memberId = extractProviderMemberId(user)

    if (!memberId) {
      return errorResponse(
        ErrorCodes.VALIDATION,
        'No LinkedIn identity linked to this account.',
        400,
        requestId,
      )
    }

    const capabilities = capabilitiesForSession(user)

    // getUser() does not carry provider_token — fetch the live session via
    // getSession() which exposes the in-memory cookie-based session including
    // the provider_token that Supabase stored on the OIDC callback.
    const {
      data: { session: liveSession },
    } = await session.supabase.auth.getSession()

    const providerToken =
      typeof liveSession?.provider_token === 'string'
        ? liveSession.provider_token
        : null

    if (!providerToken) {
      return errorResponse(
        ErrorCodes.UNAUTHENTICATED,
        'LinkedIn grant is not active. Please sign in again.',
        401,
        requestId,
      )
    }

    const apiClient = new LinkedInApiClient({
      baseUrl: LINKEDIN_API_BASE,
      tokenProvider: {
        async getAccessToken() {
          return providerToken
        },
      },
    })

    const provider = createLinkedInProvider({
      api: apiClient,
      capabilities,
    })

    const persistence = createLinkedInPersistence(session.supabase)

    const snapshot = await syncLinkedInProvider({
      provider,
      memberId,
      persistence,
    })

    if (snapshot.state === 'provider_revoked') {
      return errorResponse(
        ErrorCodes.UNAUTHENTICATED,
        'LinkedIn access was revoked. Please reconnect and try again.',
        401,
        requestId,
      )
    }

    if (snapshot.state !== 'synced') {
      return errorResponse(
        ErrorCodes.EXTERNAL_SERVICE,
        'LinkedIn sync failed. Try again later.',
        502,
        requestId,
      )
    }

    return NextResponse.json(apiOk({}), {
      headers: { 'x-request-id': requestId ?? '' },
    })
  } catch (error) {
    logger.error('LinkedIn sync API failed', { error })

    return errorResponse(
      ErrorCodes.EXTERNAL_SERVICE,
      'LinkedIn sync failed. Try again later.',
      500,
      requestId,
    )
  }
}

export const POST = withAuth(handlePost)
