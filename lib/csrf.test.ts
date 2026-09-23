// lib/csrf.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Env required for lib/env lazy validation to resolve in the test runner ──
// Must be set before the first `env` property access inside the module under
// test (generateCsrfToken → csrfSecret → env.CSRF_SECRET).
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token'
process.env.ABLY_API_KEY = 'ably-key'
process.env.RESEND_API_KEY = 'resend-key'
process.env.CSRF_SECRET = 'test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

import {
  extractCsrfToken,
  generateCsrfToken,
  verifyCsrfToken,
  withCsrf,
} from '@/lib/csrf'

// Mock `next/headers` so withCsrf can read the request cookie/header in the
// test runner (next/headers is request-scoped and unsupported outside a
// Server Action / Route Handler).
const nextHeadersMock = vi.hoisted(() => {
  const state: { cookie: string | null; header: string | null } = {
    cookie: null,
    header: null,
  }
  return {
    state,
    cookies: async () => ({
      get: () =>
        state.cookie ? { name: '__Host-csrf', value: state.cookie } : undefined,
    }),
    headers: async () => ({
      get: (name: string) => (name === 'x-csrf-token' ? state.header : null),
    }),
  }
})

vi.mock('next/headers', () => ({
  cookies: nextHeadersMock.cookies,
  headers: nextHeadersMock.headers,
}))

describe('generateCsrfToken / verifyCsrfToken', () => {
  it('mints a token and a distinct HMAC cookie value', () => {
    const { token, cookieValue } = generateCsrfToken()
    expect(token.length).toBeGreaterThan(0)
    expect(cookieValue.length).toBeGreaterThan(0)
    expect(token).not.toBe(cookieValue)
  })

  it('verifies a genuine token against its matching cookie value', () => {
    const { token, cookieValue } = generateCsrfToken()
    expect(verifyCsrfToken(token, cookieValue)).toBe(true)
  })

  it('rejects a forged cookie value', () => {
    const { token } = generateCsrfToken()
    expect(verifyCsrfToken(token, 'forged-cookie-value')).toBe(false)
  })

  it('rejects a token that does not match another cookie value', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(verifyCsrfToken(a.token, b.cookieValue)).toBe(false)
    expect(verifyCsrfToken(b.token, a.cookieValue)).toBe(false)
  })

  it('rejects empty or missing values', () => {
    const { token, cookieValue } = generateCsrfToken()
    expect(verifyCsrfToken('', cookieValue)).toBe(false)
    expect(verifyCsrfToken(token, '')).toBe(false)
    expect(verifyCsrfToken('', '')).toBe(false)
  })

  it('mints a unique token per call', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(a.token).not.toBe(b.token)
    expect(a.cookieValue).not.toBe(b.cookieValue)
  })
})

describe('extractCsrfToken', () => {
  it('prefers the x-csrf-token header over the form field', () => {
    const headers = new Headers({ 'x-csrf-token': 'from-header' })
    const formData = new FormData()
    formData.set('csrfToken', 'from-form')
    expect(extractCsrfToken(headers, formData)).toBe('from-header')
  })

  it('falls back to the csrfToken form field when the header is absent', () => {
    const headers = new Headers()
    const formData = new FormData()
    formData.set('csrfToken', 'from-form')
    expect(extractCsrfToken(headers, formData)).toBe('from-form')
  })

  it('returns null when neither the header nor the form field is present', () => {
    expect(extractCsrfToken(new Headers())).toBeNull()
    expect(extractCsrfToken(new Headers(), new FormData())).toBeNull()
  })
})

describe('withCsrf', () => {
  const run = vi.fn()

  beforeEach(() => {
    run.mockReset()
    nextHeadersMock.state.cookie = null
    nextHeadersMock.state.header = null
  })

  it('runs the action on a valid cookie + header token pair', async () => {
    const { token, cookieValue } = generateCsrfToken()
    nextHeadersMock.state.cookie = cookieValue
    nextHeadersMock.state.header = token
    run.mockResolvedValue({ ok: true })

    const guarded = withCsrf(async () => run())
    const result = await guarded()

    expect(result).toEqual({ ok: true })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('accepts the token from a FormData csrfToken field', async () => {
    const { token, cookieValue } = generateCsrfToken()
    nextHeadersMock.state.cookie = cookieValue
    run.mockResolvedValue('done')

    const guarded = withCsrf(async (_prev, formData) => run(formData))
    const formData = new FormData()
    formData.set('csrfToken', token)
    const result = await guarded(null, formData)

    expect(result).toBe('done')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('returns the denial envelope and skips the action when the cookie is missing', async () => {
    const { token } = generateCsrfToken()
    nextHeadersMock.state.header = token
    run.mockResolvedValue('should-not-run')

    const guarded = withCsrf(async () => run())
    const result = await guarded()

    expect(run).not.toHaveBeenCalled()
    expect(result).toMatchObject({ error: { code: 'FORBIDDEN' } })
    expect(
      (result as { error: { message: string } }).error.message.length,
    ).toBeGreaterThan(0)
  })

  it('returns the denial envelope on a mismatched token', async () => {
    const { cookieValue } = generateCsrfToken()
    nextHeadersMock.state.cookie = cookieValue
    nextHeadersMock.state.header = 'wrong-token'
    run.mockResolvedValue('should-not-run')

    const guarded = withCsrf(async () => run())
    const result = await guarded()

    expect(run).not.toHaveBeenCalled()
    expect(result).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('collapses the envelope via onDenied for state-shaped callers', async () => {
    const { token } = generateCsrfToken()
    nextHeadersMock.state.cookie = 'wrong-cookie'
    nextHeadersMock.state.header = token

    const guarded = withCsrf(
      async () =>
        ({ ok: true, error: null }) as { ok: boolean; error: string | null },
      {
        onDenied: (payload) => ({ ok: false, error: payload.error.message }),
      },
    )
    const result = await guarded()

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error.length).toBeGreaterThan(0)
  })
})
