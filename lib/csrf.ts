// src/lib/csrf.ts
import { createHmac, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { env } from '@/lib/env'
import { apiError, ErrorCodes, type ApiErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { safeCompare } from '@/lib/security'

/**
 * Generate a CSRF token and return it along with the cookie value.
 * - The token is a random string.
 * - The cookie value is HMAC‑signed(token).
 * Secret is read lazily: module evaluation during `next build` page-data
 * collection must not read env.
 */
function csrfSecret(): string {
  return env.CSRF_SECRET as string
}
export function generateCsrfToken(): {
  token: string
  cookieValue: string
} {
  const token = randomBytes(32).toString('base64url')
  const hmac = createHmac('sha256', csrfSecret())
  hmac.update(token)
  const cookieValue = hmac.digest('base64url')

  return { token, cookieValue }
}

/**
 * Verify a CSRF token against its cookie value.
 * Returns true if the token is valid and has not been tampered with.
 */
export function verifyCsrfToken(token: string, cookieValue: string): boolean {
  if (!token || !cookieValue) {
    return false
  }

  try {
    const hmac = createHmac('sha256', csrfSecret())
    hmac.update(token)
    const expected = hmac.digest('base64url')

    // Constant-time comparison to avoid timing attacks. `safeCompare` hashes
    // both sides first, so a length-mismatched (tampered/truncated) cookie
    // returns false instead of throwing a RangeError inside timingSafeEqual.
    return safeCompare(cookieValue, expected)
  } catch (error) {
    logger.warn('CSRF verification failed', { error: String(error) })
    return false
  }
}

/**
 * Extract CSRF token from request headers or form data.
 * Assumes the token is sent in the `X-CSRF-Token` header
 * or in the `csrfToken` form field.
 */
export function extractCsrfToken(
  headers: Headers,
  formData?: FormData,
): string | null {
  // Try header first
  const headerToken = headers.get('x-csrf-token')
  if (headerToken) {
    return headerToken
  }

  // Fallback to form data
  if (formData) {
    const formToken = formData.get('csrfToken')
    if (typeof formToken === 'string') {
      return formToken
    }
  }

  return null
}

/**
 * CSRF token storage key for cookies.
 * Use this when setting the cookie in Server Actions or middleware.
 */
export const CSRF_COOKIE_NAME = '__Host-csrf'

/**
 * Safe canned copy for the CSRF denial envelope (never leaks internals).
 * Mirrors the "stale form" wording pattern used elsewhere in the app.
 */
export const CSRF_DENIED_MESSAGE =
  'This form is stale. Refresh the page and try again.'

export interface WithCsrfOptions<TResult> {
  /**
   * Collapse the canonical denial envelope into a caller-shaped value.
   * Required for actions bound to `useActionState`, whose state type cannot
   * include the raw `ApiErrorPayload` envelope.
   */
  onDenied?: (payload: ApiErrorPayload) => TResult | Promise<TResult>
}

/**
 * CSRF guard HOF for Server Actions.
 *
 * (a) reads the `__Host-csrf` cookie,
 * (b) reads the `x-csrf-token` header or a `csrfToken` field on any FormData
 *     argument (React form actions pass FormData; the position is irrelevant),
 * (c) verifies via `verifyCsrfToken` (constant-time HMAC compare),
 * (d) on failure returns the canonical `ApiErrorPayload` denial envelope
 *     (lib/errors.ts) WITHOUT running the wrapped action — or the mapped value
 *     from `options.onDenied` when provided — else runs the action.
 *
 * `next/headers` is request-scoped, so the wrapper must be invoked inside a
 * Server Action / Route Handler (never from render).
 */
export function withCsrf<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: WithCsrfOptions<TResult>,
): (...args: TArgs) => Promise<TResult>
export function withCsrf<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult | ApiErrorPayload>
export function withCsrf<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: WithCsrfOptions<TResult>,
): (...args: TArgs) => Promise<TResult | ApiErrorPayload> {
  return async (...args: TArgs): Promise<TResult | ApiErrorPayload> => {
    const cookieStore = await cookies()
    const headerStore = await headers()

    const cookieValue = cookieStore.get(CSRF_COOKIE_NAME)?.value
    const formData = args.find(
      (arg): arg is FormData => arg instanceof FormData,
    )
    const token = extractCsrfToken(headerStore, formData)

    if (!cookieValue || !token || !verifyCsrfToken(token, cookieValue)) {
      logger.warn('withCsrf: token rejected', {
        hasCookie: Boolean(cookieValue),
        hasToken: Boolean(token),
      })
      const denial = apiError(ErrorCodes.FORBIDDEN, CSRF_DENIED_MESSAGE)
      if (options?.onDenied) return options.onDenied(denial)
      return denial
    }

    return action(...args)
  }
}
