// src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { isSafeRedirectUrl } from '@/lib/redirect'
import {
  authIpRatelimit,
  readRatelimit,
  writeRatelimit,
  swipeRatelimit,
  searchRatelimit,
  messageRatelimit,
  checkRateLimit,
  getRateLimitHeaders,
  type RatelimitClient,
} from '@/lib/ratelimit'
import { isUserSuspended } from '@/lib/suspension'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
    '/login',
    '/callback',
    '/admin/:path*',
    '/traction',
    '/settings/security',
  ],
}

// Guest-safe APIs: reachable without auth, but still rate-limited.
// Every other /api/* route requires authentication.
// `/api/health` is infrastructure, not product: liveness/readiness probes must
// never be redirected to /login or a container can never become ready.
const PUBLIC_API_PREFIXES = [
  '/api/browse',
  '/api/search',
  '/api/health',
  '/api/security/csp-report',
]

function isPublicApi(path: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

// ——— Operation groups (audit #86) ———
// A user shares ONE budget per operation group regardless of which endpoint
// path they hit, so moving between endpoints cannot multiply the budget.
// Group budgets: swipe 100/min, search 60/min, message 120/min, auth 10/min/IP,
// everything else falls back to the coarse read/write budget.
function operationGroup(
  path: string,
  method?: string,
): {
  group: string
  limiter: RatelimitClient
  scoped: 'user' | 'ip'
} {
  if (path.startsWith('/api/swipe') || path.includes('/actions/swipe')) {
    return { group: 'swipe', limiter: swipeRatelimit, scoped: 'user' }
  }
  if (path.startsWith('/api/search') || path.includes('/search')) {
    return { group: 'search', limiter: searchRatelimit, scoped: 'user' }
  }
  if (path.includes('/chat') || path.includes('/message')) {
    return { group: 'message', limiter: messageRatelimit, scoped: 'user' }
  }
  if (path.startsWith('/api/auth') || path.startsWith('/login')) {
    return { group: 'auth', limiter: authIpRatelimit, scoped: 'ip' }
  }
  // General group keeps the coarse read/write split (100 vs 30 per minute).
  const isMutation = method !== 'GET' && method !== 'HEAD'
  return {
    group: 'general',
    limiter: isMutation ? writeRatelimit : readRatelimit,
    scoped: 'user',
  }
}

function clientIp(request: NextRequest): string {
  // #87 — deployment infra MUST overwrite the forwarded headers at the edge
  // before they reach us; never trust a caller-supplied header as authoritative.
  // (NextRequest.ip is unavailable in this Next version, so we rely on headers
  // being infra-rewritten — verified with the platform.)
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/

/**
 * Correlation id for log/trace stitching. A trusted upstream value is reused
 * when it passes a strict charset/length check (a hostile header must never be
 * able to inject markers or newlines into structured logs); otherwise a fresh
 * UUID is minted. Web Crypto is available in both the Node and Edge runtimes.
 */
export function resolveRequestId(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id')
  return incoming !== null && REQUEST_ID_RE.test(incoming)
    ? incoming
    : crypto.randomUUID()
}

/**
 * Proxy entry point. Wraps the gate logic so EVERY branch — pass-through,
 * redirect, 429 and 403 — carries the same `x-request-id` response header.
 */
export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request)
  const response = await handleProxy(request, requestId)
  response.headers.set('x-request-id', requestId)
  return response
}

async function handleProxy(request: NextRequest, requestId: string) {
  const path = request.nextUrl.pathname
  const method = request.method

  const passThrough = () => NextResponse.next()

  // Degraded pass-through: when the app isn't configured (no .env.local, e.g.
  // local demo/dev shells), the auth gateway below cannot run — instantiating
  // the Supabase SSR client would throw on `env.NEXT_PUBLIC_SUPABASE_URL` and
  // 500 every proxied route. Pass every request through instead so the themed
  // pages still render. The instant the env is configured, the full gate
  // (auth redirects, suspension, per-group rate limits) re-engages below.
  if (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL !== 'string' ||
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'string'
  ) {
    return passThrough()
  }

  let response = passThrough()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = passThrough()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Identity from the signed JWT (JWKS-verified, cached) with getUser()
  // fallback — mirrors lib/auth.ts (ADV-01 / Supabase SSR guidance).
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const claimsSub = claimsData?.claims?.sub

  let userId: string | null =
    typeof claimsSub === 'string' && claimsSub ? claimsSub : null

  if (!userId && claimsError) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    userId = user?.id ?? null
  }

  // Guest-safe routes: skip the auth redirect, but still rate-limit by IP
  // (operation-group). Search gets its dedicated 60/min/IP search budget.
  if (isPublicApi(path) && !userId) {
    const op = operationGroup(path, method)
    const identifier = `guest:${clientIp(request)}:${op.group}`
    const rateLimit = await checkRateLimit(identifier, op.limiter)
    if (!rateLimit.success) {
      logger.warn('Guest API rate limit exceeded', {
        ip: clientIp(request),
        path,
        method,
      })
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: getRateLimitHeaders(rateLimit, true),
      })
    }
    return response
  }

  // #115 — machine routes authenticate with service credentials, not user
  // sessions. /api/queue/worker validates WORKER_SECRET inside the route;
  // the proxy must NOT demand a human session here or the worker can never
  // reach it (its secret-auth request would be redirected to /login).
  if (path === '/api/queue/worker') {
    return response
  }

  // /callback (OAuth round-trip) must be public: the PKCE code-exchange lands
  // here with no session yet, so the generic `!userId` redirect below would
  // bounce it to /login and break sign-in. Matcher includes it so the gate
  // documents the exemption explicitly, then passes it straight through —
  // but still rate-limited by IP on the auth group (same budget as /login).
  if (path === '/callback') {
    const identifier = `guest:${clientIp(request)}:callback`
    const rateLimit = await checkRateLimit(identifier, authIpRatelimit)
    if (!rateLimit.success) {
      logger.warn('Guest /callback rate limit exceeded', {
        ip: clientIp(request),
        path,
        method,
      })
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: getRateLimitHeaders(rateLimit, true),
      })
    }
    return response
  }

  // A logged-out user must be able to REACH /login to sign in. The /login
  // matcher means the generic `!userId` redirect below would otherwise bounce
  // /login → /login?next=/login forever (self-loop). Treat the guest login
  // page as public-but-rate-limited by the auth group (10/min/IP), mirroring
  // the guest-safe /api handling above. The authenticated branch below (also
  // keyed on /login) resolves `next` → dashboard.
  if (path === '/login' && !userId) {
    const op = operationGroup(path, method)
    const identifier = `guest:${clientIp(request)}:${op.group}`
    const rateLimit = await checkRateLimit(identifier, op.limiter)
    if (!rateLimit.success) {
      logger.warn('Guest /login rate limit exceeded', {
        ip: clientIp(request),
        path,
        method,
      })
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: getRateLimitHeaders(rateLimit, true),
      })
    }
    return response
  }

  if (!userId) {
    const loginUrl = new URL('/login', request.url)
    // Client-supplied path must pass the canonical validator BEFORE the proxy
    // writes it into the `next` param (HOST-AUTH-06); otherwise an attacker
    // could smuggle a protocol-relative-ish pathname into the login target.
    const rawNext = `${request.nextUrl.pathname}${request.nextUrl.search}`
    if (isSafeRedirectUrl(rawNext)) {
      loginUrl.searchParams.set('next', rawNext)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users never see the login form (S01 gate): /login with a
  // valid session resolves the canonical `next` and forwards to the Discover
  // deck (POST_LOGIN_ROUTE) unless a safe deep-link was requested.
  if (path === '/login') {
    const requested = request.nextUrl.searchParams.get('next')
    const target =
      requested && isSafeRedirectUrl(requested) ? requested : POST_LOGIN_ROUTE
    return NextResponse.redirect(new URL(target, request.url))
  }

  // `userId` is non-null here (gated above).

  // Suspension gate (TODO C): a valid session with profiles.suspended_at set
  // gets no dashboard/API access. One authority: this check, before anything else.
  const suspended = await isUserSuspended(supabase, userId)

  if (suspended) {
    logger.warn('Suspended user blocked', { userId, path })
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/suspended', request.url))
  }

  const identifier = `${userId}:${operationGroup(path, method).group}`
  const { limiter } = operationGroup(path, method)

  const rateLimit = await checkRateLimit(identifier, limiter)

  if (!rateLimit.success) {
    logger.warn('Rate limit exceeded', {
      userId,
      group: operationGroup(path, method).group,
      path,
      method,
    })

    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: getRateLimitHeaders(rateLimit),
    })
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', userId)
  // Correlation id travels upstream so route handlers can log with it.
  requestHeaders.set('x-request-id', requestId)

  response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  Object.entries(getRateLimitHeaders(rateLimit)).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
