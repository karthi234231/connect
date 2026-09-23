// src/lib/auth.ts

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes, apiError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  ensureCapability,
  resolveTierFromProfile,
  type Capability,
  type ProfileTierSource,
} from '@/services/auth/capabilities'

export interface CurrentSession {
  userId: string
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
}

export function getRequestId(req: Request): string | undefined {
  return req.headers.get('x-request-id') ?? undefined
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createServerSupabaseClient()

  // ADV-01 / Supabase SSR guidance: verify identity from the signed JWT
  // (getClaims → JWKS, cached) instead of a per-request getUser() round trip.
  // getUser() stays for callers that need a fresh Auth user record.
  const { data, error } = await supabase.auth.getClaims()

  const sub = data?.claims?.sub

  if (typeof sub === 'string' && sub) {
    return { userId: sub, supabase }
  }

  // Fallback (e.g. JWKS temporarily unavailable): re-validate via auth server.
  // A genuinely invalid token fails there too, so this preserves server-truth.
  if (error) {
    logger.debug(
      'getCurrentSession: getClaims failed, falling back to getUser',
      {
        error: error.message,
      },
    )
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  return {
    userId: user.id,
    supabase,
  }
}

export async function requireUser(): Promise<string> {
  const { userId } = await requireActiveUser()
  return userId
}

export interface AuthProfileState {
  id: string
  suspendedAt: string | null
}

/**
 * Central lifecycle gate (audit ADV-01): identity from the verified session,
 * then profile lifecycle fields only. Missing profile → provisioning required;
 * suspended → forbidden. Profiles have no soft-delete column (GDPR hard-erase,
 * ADR-006), so "deleted" manifests as a missing profile.
 */
export async function requireActiveUser(): Promise<{
  userId: string
  session: CurrentSession
  profile: AuthProfileState
}> {
  const session = await requireSession()

  const { data: profile, error } = await session.supabase
    .from('profiles')
    .select('id, suspended_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    logger.error('requireActiveUser: profile lookup failed', {
      userId: session.userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify account status', {
      cause: error,
    })
  }

  if (!profile) {
    logger.warn('requireActiveUser: profile missing', {
      userId: session.userId,
    })

    throw new AppError(
      ErrorCodes.PROFILE_PROVISIONING_REQUIRED,
      'Account setup has not finished. Please try signing in again.',
    )
  }

  const suspendedAt =
    typeof profile.suspended_at === 'string' ? profile.suspended_at : null

  if (suspendedAt) {
    logger.warn('requireActiveUser: denied (suspended)', {
      userId: session.userId,
    })

    throw new AppError(
      ErrorCodes.FORBIDDEN_SUSPENDED,
      'Your account is suspended. Contact support if you believe this is a mistake.',
    )
  }

  return {
    userId: session.userId,
    session,
    profile: { id: profile.id, suspendedAt: null },
  }
}

export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession()

  if (!session) {
    throw AppError.unauthenticated('You must be logged in.')
  }

  return session
}

export function isAdmin(appRole?: string | null): boolean {
  return appRole === 'admin'
}

/**
 * Server-side capability enforcement — THE authoritative gate (S12).
 * Chain: request → auth (requireSession) → capability (requireCapability) →
 * resource authorization → mutation. UI gates are only a rendering convenience;
 * this is where a denied capability is actually rejected on the server.
 *
 * The tier is derived from the profile row (one query, piggybacks the profile
 * read the mutation already needs), then checked against the canonical
 * capability matrix. Throws AppError forbidden with safe copy from /lib/messages.
 */
export async function requireCapability(
  capability: Capability,
): Promise<{ userId: string; session: CurrentSession }> {
  const session = await requireSession()

  const { data: profile, error } = await session.supabase
    .from('profiles')
    .select('onboarding_status, app_role, suspended_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    logger.error('requireCapability: profile lookup failed', {
      userId: session.userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify capabilities', {
      cause: error,
    })
  }

  const source: ProfileTierSource | null = profile
    ? {
        onboarding_status: profile?.onboarding_status as
          'pending' | 'completed' | null,
        app_role: profile?.app_role as string | null,
        suspended_at: (profile?.suspended_at as string | null) ?? null,
      }
    : null

  const tier = resolveTierFromProfile(source)
  const denial = ensureCapability(tier, capability)

  if (denial) {
    logger.warn('requireCapability: denied', {
      userId: session.userId,
      capability,
      tier,
    })

    throw AppError.forbidden(denial.message)
  }

  return { userId: session.userId, session }
}

export async function requireAdmin(): Promise<string> {
  const session = await getCurrentSession()

  if (!session) {
    throw AppError.unauthenticated('You must be logged in.')
  }

  // Lifecycle first, then role (P0-15): an admin whose account is suspended or
  // whose profile is missing must be denied by the SAME active-user gate every
  // other boundary uses — never by role alone. Read both fields in one query so
  // the centralized check costs no extra round trip.
  const { data: profile, error } = await session.supabase
    .from('profiles')
    .select('app_role, suspended_at')
    .eq('id', session.userId)
    .maybeSingle()

  if (error) {
    logger.error('requireAdmin: profile lookup failed', {
      userId: session.userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify admin role', {
      cause: error,
    })
  }

  if (!profile) {
    logger.warn('requireAdmin: denied (profile missing)', {
      userId: session.userId,
    })
    throw new AppError(
      ErrorCodes.PROFILE_PROVISIONING_REQUIRED,
      'Account setup has not finished. Please try signing in again.',
    )
  }

  if (typeof profile.suspended_at === 'string' && profile.suspended_at) {
    logger.warn('requireAdmin: denied (suspended)', { userId: session.userId })
    throw new AppError(
      ErrorCodes.FORBIDDEN_SUSPENDED,
      'Your account is suspended. Contact support if you believe this is a mistake.',
    )
  }

  const appRole = typeof profile.app_role === 'string' ? profile.app_role : null
  if (!isAdmin(appRole)) {
    logger.warn('requireAdmin: denied (non-admin)', {
      userId: session.userId,
    })

    throw AppError.forbidden('Admin privileges are required for this action.')
  }

  return session.userId
}

export type AuthHandler<Ctx = unknown> = (
  session: CurrentSession,
  req: Request,
  ctx?: Ctx,
) => Promise<Response>

function withRequestId(response: Response, requestId?: string): Response {
  if (!requestId) return response
  try {
    response.headers.set('x-request-id', requestId)
    return response
  } catch {
    const headers = new Headers(response.headers)
    headers.set('x-request-id', requestId)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

export function withAuth<Ctx = Record<string, unknown>>(
  handler: AuthHandler<Ctx>,
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const requestId = getRequestId(req)
    const session = await getCurrentSession()

    if (!session) {
      return withRequestId(
        new Response(
          JSON.stringify(
            apiError(
              ErrorCodes.UNAUTHENTICATED,
              'Authentication required.',
              requestId,
            ),
          ),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
        requestId,
      )
    }

    try {
      return withRequestId(await handler(session, req, ctx), requestId)
    } catch (error) {
      logger.error('Auth handler error', { requestId, error })
      return withRequestId(
        new Response(
          JSON.stringify(
            apiError(ErrorCodes.INTERNAL, 'Internal server error.', requestId),
          ),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
        requestId,
      )
    }
  }
}
