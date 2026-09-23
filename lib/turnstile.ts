// src/lib/turnstile.ts
// Cloudflare Turnstile server-side verification.
//
// Fail-closed by design (ADR-007): once `TURNSTILE_SECRET_KEY` is configured,
// ANY failure — invalid token shape, upstream HTTP error, network error,
// malformed response, or a `success:false` verdict — is a DENY, never allow.
//
// ⚠️ SOFT-SKIP ONLY when unconfigured: if `TURNSTILE_SECRET_KEY` is unset the
// integration is treated as disabled and verification is SKIPPED entirely
// (returns `{ok:true}`). This is deliberate and LOUD (we log a warning on every
// call) so an operator who expects bot protection but forgot the secret sees it
// immediately. The UI gates the widget behind the flag + site key, and this
// module gates enforcement behind the secret — three independent knobs.
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export type TurnstileResult = { ok: true } | { ok: false; code: string }

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Cloudflare siteverify request: POST, application/x-www-form-urlencoded,
// fields `secret`, `response` (the client token) and optional `remoteip`.
// Response is JSON `{success: boolean, "error-codes": string[]?}`.
//
// Token shape guard: Turnstile tokens are opaque base64url-ish strings with dot
// separators (e.g. `0.<clientdata>.<token>`). Bound the charset/length so we
// never forward an arbitrary blob, then let siteverify be the final judge.
const TURNSTILE_TOKEN_RE = /^[0-9A-Za-z_.-]{20,2048}$/

interface SiteVerifyResponse {
  success: boolean
  'error-codes'?: string[]
}

export function isTurnstileToken(value: unknown): value is string {
  return typeof value === 'string' && TURNSTILE_TOKEN_RE.test(value)
}

/**
 * Verify a Turnstile widget token server-side.
 *
 * @param token The `cf-turnstile-response` value from the form.
 * @param ip    Optional client IP forwarded to Cloudflare as `remoteip`.
 * @returns `{ok:true}` when the token passes (or when the secret is unset and
 *          the integration is skipped); `{ok:false, code}` on any failure.
 */
export async function verifyTurnstile(
  token?: string | null,
  ip?: string,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY

  // SOFT-SKIP for unconfigured deployments — document loudly. The UI never
  // renders the widget when the site key is absent, and this module never
  // enforces when the secret is absent. Once either is set, the gate is real.
  if (!secret) {
    logger.warn(
      'verifyTurnstile: TURNSTILE_SECRET_KEY is not set — Turnstile verification SKIPPED (integration disabled).',
    )
    return { ok: true }
  }

  if (!isTurnstileToken(token)) {
    return { ok: false, code: 'invalid-token' }
  }

  const params = new URLSearchParams()
  params.set('secret', secret)
  params.set('response', token)
  if (ip) params.set('remoteip', ip)

  let response: Response
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    })
  } catch (error) {
    // ADR-007: network failure with a configured secret is a DENY.
    logger.error('verifyTurnstile: siteverify network error (fail closed)', {
      error: String(error),
    })
    return { ok: false, code: 'network-error' }
  }

  if (!response.ok) {
    logger.error('verifyTurnstile: siteverify non-2xx (fail closed)', {
      status: response.status,
    })
    return { ok: false, code: 'upstream-http-error' }
  }

  let data: SiteVerifyResponse
  try {
    data = (await response.json()) as SiteVerifyResponse
  } catch (error) {
    logger.error(
      'verifyTurnstile: siteverify malformed response (fail closed)',
      {
        error: String(error),
      },
    )
    return { ok: false, code: 'malformed-response' }
  }

  if (data.success === true) {
    return { ok: true }
  }

  return {
    ok: false,
    code: data['error-codes']?.join(',') || 'verification-failed',
  }
}
