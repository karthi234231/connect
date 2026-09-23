// src/lib/redirect.ts
// HOST-AUTH-06 — THE single canonical open-redirect validator for all auth and
// navigation callers (server proxy/callback/login and client login-form).
//
// Pure and dependency-free so both RSC/server and client ("use client")
// components can import it. It intentionally rejects protocol-relative (//),
// backslash/encoded traversal, raw controls, and anything not starting with a
// single slash. Callers must never maintain their own local copy of this logic.
export function isSafeRedirectUrl(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false

  // Protocol-relative (//host) and backslash-lead (/\\host) escapes.
  if (value.startsWith('//') || value.startsWith('/\\')) return false

  // Raw control characters (CR/LF) can split response headers.
  if (value.includes('\r') || value.includes('\n')) return false

  // Backslashes anywhere defeat forward-slash-only origin parsing — both the
  // literal character and percent-encoded forms (HOST-AUTH-06). Rejecting the
  // encoded variant is fail-closed and covers downstream decode-based matchers.
  if (value.includes('\\')) return false
  if (/%(5c|5C)/.test(value)) return false

  // Percent-encoded forward slashes (%2f) can re-introduce dot-segments after a
  // downstream URL-decode (…/..%2f..%2f → ../../…), escaping the same-origin
  // path contract. Rejecting them is fail-closed like %5c (HOST-AUTH-06).
  if (/%(2f|2F)/.test(value)) return false

  // Must be a same-origin absolute path.
  if (!value.startsWith('/')) return false

  return true
}
