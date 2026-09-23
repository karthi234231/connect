// src/services/auth/mfa.ts
import { randomBytes } from 'node:crypto'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

export async function generateTOTP(userId: string) {
  const secret = speakeasy.generateSecret({ name: `Connect:${userId}` })
  return {
    secret: secret.base32,
    qr: await QRCode.toDataURL(secret.otpauth_url!),
  }
}

export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  })
}

/**
 * One-time recovery codes shown after the first verified enrolment, for when
 * the authenticator app is unavailable. Each code is single-use at the hands
 * of the verifier; this helper only mints cryptographically random groups —
 * persistence/revocation lives at the call site (the DB column does not exist
 * yet — see TODO in app/settings/security/page.tsx).
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const block = randomBytes(5).toString('hex').toUpperCase()
    codes.push(`${block.slice(0, 5)}-${block.slice(5)}`)
  }
  return codes
}
