// src/app/callback/route.ts
// OAuth round-trip: PKCE code exchange → provisioning → best-effort provider
// extraction → safe redirect.
// MUST be a Route Handler (not a page.tsx): exchangeCodeForSession needs to
// write session cookies, and Server Components cannot set cookies — the old
// page.tsx exchanged successfully then silently dropped the session, so every
// sign-in bounced straight back to /login?next=/dashboard.
//
// The post-login LinkedIn sync is strictly best-effort: it runs only when the
// exchanged session actually carries a provider access token, is wrapped so a
// failure can never abort or delay the login redirect, and only ever claims
// capabilities the declared grant actually supports (see runBestEffortLinkedInSync).
import { NextResponse, type NextRequest } from 'next/server'
import type { Session, User } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { isSafeRedirectUrl } from '@/lib/redirect'
import { provisionAndRoute } from '@/services/auth'
import {
  LinkedInApiClient,
  NO_PROVIDER_DATA_SUPPLY,
  capabilitiesForSession,
  createLinkedInProvider,
  extractProviderAccessToken,
  extractProviderMemberId,
  hasCapability,
  sessionAccessTokenProvider,
  syncLinkedInProvider,
} from '@/services/linkedin'
import { createLinkedInPersistence } from '@/services/linkedin/persistence'

const LINKEDIN_API_BASE = 'https://api.linkedin.com'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function loginRedirect(
  origin: string,
  query: string,
  cookies: CookieToSet[],
): NextResponse {
  const response = NextResponse.redirect(new URL(`/login${query}`, origin))
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options)
  }
  return response
}

/**
 * Best-effort post-login LinkedIn extraction: identity (name/email/photo),
 * plus headline only when the LinkedIn app was granted the classic
 * `r_basicprofile` scope AND LinkedIn declared it to Supabase. Experience and
 * education are NEVER derived here — OIDC scopes never return them (only an
 * approved-cache supply does, which the sign-in flow does not have) — so the
 * provider-data supply is explicitly NO_PROVIDER_DATA_SUPPLY and no capability
 * claim is invented.
 *
 * Non-fatal by construction: a missing grant skips quietly, a member id is
 * required, and every failure is logged and swallowed. The OAuth redirect the
 * user sees is built AFTER this and never changes because of sync state.
 */
async function runBestEffortLinkedInSync(
  supabase: ReturnType<typeof createServerClient>,
  session: Session | null,
  user: User,
): Promise<void> {
  if (!session) return

  if (!extractProviderAccessToken(session)) {
    const { logger } = await import('@/lib/logger')
    logger.debug(
      'callback: no LinkedIn provider grant; skipping post-login sync',
    )
    return
  }

  const memberId = extractProviderMemberId(user)
  if (!memberId) {
    const { logger } = await import('@/lib/logger')
    logger.debug('callback: no LinkedIn member id; skipping post-login sync')
    return
  }

  try {
    const capabilities = capabilitiesForSession(user, NO_PROVIDER_DATA_SUPPLY)
    if (!hasCapability(capabilities, 'identity')) return
    const provider = createLinkedInProvider({
      api: new LinkedInApiClient({
        baseUrl: LINKEDIN_API_BASE,
        tokenProvider: sessionAccessTokenProvider(session),
      }),
      capabilities,
    })
    const snapshot = await syncLinkedInProvider({
      provider,
      memberId,
      persistence: createLinkedInPersistence(supabase),
    })
    const { logger } = await import('@/lib/logger')
    logger.info('callback: post-login LinkedIn sync complete', {
      providerUserId: memberId,
      state: snapshot.state,
    })
  } catch (error) {
    const { logger } = await import('@/lib/logger')
    logger.error(
      'callback: post-login LinkedIn sync failed (non-fatal)',
      { providerUserId: memberId },
      error,
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorCode =
    url.searchParams.get('error') ?? url.searchParams.get('error_code')
  const requestedNext = url.searchParams.get('next') ?? POST_LOGIN_ROUTE

  const cookiesToSet: CookieToSet[] = []
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(list) {
          for (const { name, value, options } of list) {
            request.cookies.set(name, value)
            cookiesToSet.push({ name, value, options })
          }
        },
      },
    },
  )

  if (!code) {
    return loginRedirect(
      url.origin,
      `?error=${encodeURIComponent(errorCode ?? 'missing_code')}`,
      cookiesToSet,
    )
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const { logger } = await import('@/lib/logger')
    logger.error('callback: code exchange failed', { message: error.message })
    return loginRedirect(
      url.origin,
      '?error=oauth_exchange_failed',
      cookiesToSet,
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const { logger } = await import('@/lib/logger')
    logger.error('callback: exchange ok but getUser empty')
    return loginRedirect(
      url.origin,
      '?error=oauth_exchange_failed',
      cookiesToSet,
    )
  }

  const safeNext =
    requestedNext && isSafeRedirectUrl(requestedNext)
      ? requestedNext
      : POST_LOGIN_ROUTE
  const { redirectTo } = await provisionAndRoute(
    supabase,
    { id: user.id, email: user.email, user_metadata: user.user_metadata },
    safeNext,
  )

  // Best-effort provider extraction (identity + profile headline when granted).
  // Non-fatal: failures log only and never change the redirect below.
  await runBestEffortLinkedInSync(supabase, session, user)

  const response = NextResponse.redirect(new URL(redirectTo, url.origin))
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, options)
  }
  return response
}
