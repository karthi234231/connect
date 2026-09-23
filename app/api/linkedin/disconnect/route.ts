// src/app/api/linkedin/disconnect/route.ts
// DELETE /api/linkedin/disconnect — GDPR self-service disconnect.
// Removes the stored LinkedIn connection row, clears the provider-owned
// profile columns, and deletes imported provider-sourced experiences and
// education. The account stays active; only the LinkedIn link is severed.

import { NextResponse } from 'next/server'

import { withAuth, getRequestId } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { ErrorCodes, apiError, apiOk, type ErrorCode } from '@/lib/errors'
import { LINKEDIN_SYNC_PROVIDER } from '@/services/linkedin/persistence'

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

async function handleDelete(
  session: import('@/lib/auth').CurrentSession,
  request: Request,
) {
  const requestId = getRequestId(request)
  try {
    const { userId, supabase } = session

    // 1. Remove the connection metadata row.
    const { error: connectionError } = await supabase
      .from('profile_provider_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', LINKEDIN_SYNC_PROVIDER)

    if (connectionError) {
      logger.error('LinkedIn disconnect: failed to remove connection row', {
        userId,
        error: connectionError.message,
      })
      return errorResponse(
        ErrorCodes.INTERNAL,
        'Could not disconnect LinkedIn.',
        500,
        requestId,
      )
    }

    // 2. Clear the provider-owned identity columns on the profile.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        provider_linked_in_identity: null,
        provider_headline: null,
        provider_location: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      logger.warn('LinkedIn disconnect: failed to clear profile columns', {
        userId,
        error: profileError.message,
      })
      // Non-fatal: the connection row is already deleted.
    }

    // 3. Delete provider-sourced experiences (best-effort).
    const { error: experienceError } = await supabase
      .from('profile_experiences')
      .delete()
      .eq('user_id', userId)
      .eq('source', LINKEDIN_SYNC_PROVIDER)

    if (experienceError) {
      logger.warn('LinkedIn disconnect: failed to remove experiences', {
        userId,
        error: experienceError.message,
      })
    }

    // 4. Delete provider-sourced education (best-effort).
    const { error: educationError } = await supabase
      .from('profile_education')
      .delete()
      .eq('user_id', userId)
      .eq('source', LINKEDIN_SYNC_PROVIDER)

    if (educationError) {
      logger.warn('LinkedIn disconnect: failed to remove education', {
        userId,
        error: educationError.message,
      })
    }

    return NextResponse.json(apiOk({}), {
      headers: { 'x-request-id': requestId ?? '' },
    })
  } catch (error) {
    logger.error('LinkedIn disconnect API failed', { error })

    return errorResponse(
      ErrorCodes.INTERNAL,
      'Could not disconnect LinkedIn.',
      500,
      requestId,
    )
  }
}

export const DELETE = withAuth(handleDelete)
