// src/app/actions/auth.ts
// CSRF minting and the MFA enrolment helpers for /settings/security.
// S05 — LinkedIn OIDC is the ONLY auth provider: there is no email/password
// sign-in surface in this app, so this module intentionally exposes no
// password action (login is the LinkedIn OAuth redirect on /login + /callback).
//
// Security posture:
// - `mintCsrfTokenAction` sets the `__Host-csrf` HttpOnly cookie and returns
//   the matching token for guarded mutations (e.g. MFA enrolment).
// - MFA helpers are authenticated (`requireUser`) but deliberately unpersisted:
//   there is NO MFA column in types/database.ts yet, so enrolment is
//   session-scoped (see TODO in app/settings/security/page.tsx). They error
//   gracefully instead of throwing.
'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'

import { requireUser } from '@/lib/auth'
import { CSRF_COOKIE_NAME, generateCsrfToken } from '@/lib/csrf'
import { toErrorPayload } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  generateRecoveryCodes,
  generateTOTP,
  verifyTOTP,
} from '@/services/auth/mfa'
import { parseLinkedInOAuthScopes } from '@/services/linkedin/capabilities'

// ─── CSRF mint ──────────────────────────────────────────────
// Called by guarded mutations: sets the HttpOnly cookie server-side and hands
// the raw token to the client so it can be echoed back on submit.
export async function mintCsrfTokenAction(): Promise<{ token: string }> {
  const { token, cookieValue } = generateCsrfToken()
  const cookieStore = await cookies()
  cookieStore.set(CSRF_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 minutes; refresh on submit keeps the session going
  })
  return { token }
}

// ─── LinkedIn OAuth scopes ──────────────────────────────────
// The login page asks LinkedIn for the scopes this app is configured to
// request (`LINKEDIN_OAUTH_SCOPES`, identity-only by default). Resolving the
// list server-side means the browser never embeds a hard-coded extended grant
// and a malformed env value can never break identity sign-in (the parser falls
// back to the identity default — see parseLinkedInOAuthScopes).
export async function scopesForOAuth(): Promise<string[]> {
  return parseLinkedInOAuthScopes()
}

// ─── MFA enrolment (session-scoped — no DB column yet) ──────
const mfaSecretSchema = z.string().min(1).max(200)
const mfaCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.')

export type MfaSecretResult =
  { ok: true; secret: string; qrDataUrl: string } | { ok: false; error: string }

export type MfaVerifyResult =
  { ok: true; recoveryCodes: string[] } | { ok: false; error: string }

function mfaFailure(scope: string, error: unknown): MfaVerifyResult {
  logger.error(`MFA enrolment failed: ${scope}`, { error })
  return { ok: false, error: toErrorPayload(error).message }
}

export async function generateMfaSecretAction(): Promise<MfaSecretResult> {
  try {
    const userId = await requireUser()
    const { secret, qr } = await generateTOTP(userId)
    return { ok: true, secret, qrDataUrl: qr }
  } catch (error) {
    return { ok: false, error: toErrorPayload(error).message }
  }
}

export async function verifyMfaSetupAction(input: {
  secret: string
  code: string
}): Promise<MfaVerifyResult> {
  try {
    await requireUser()

    if (!mfaSecretSchema.safeParse(input.secret).success) {
      return { ok: false, error: 'That setup is not valid. Try again.' }
    }
    if (!mfaCodeSchema.safeParse(input.code).success) {
      return { ok: false, error: 'Enter the 6-digit code.' }
    }

    if (!verifyTOTP(input.secret, input.code)) {
      logger.warn('verifyMfaSetupAction: code rejected')
      return {
        ok: false,
        error:
          'That code was not accepted. Check the time on your device and try again.',
      }
    }

    // TODO(WS-1): persist enrolment requires an MFA migration (no column in
    // types/database.ts). Until then enrolment + codes are session-scoped.
    return { ok: true, recoveryCodes: generateRecoveryCodes() }
  } catch (error) {
    return mfaFailure('verify', error)
  }
}
