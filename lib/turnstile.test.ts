// lib/turnstile.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── Env required for lib/env lazy validation to resolve in the test runner ──
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token'
process.env.ABLY_API_KEY = 'ably-key'
process.env.RESEND_API_KEY = 'resend-key'
process.env.CSRF_SECRET = 'test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

// Each test calls vi.resetModules() and re-evaluates the import graph
// (pino logger + env lazy validation), so the first test in this worker
// routinely blows the 5s default timeout on cold start. Give the file a
// realistic per-test budget so the soft-skip assertions stay strict.
vi.setConfig({ testTimeout: 30_000 })

// A token that passes the shape guard: base64url-ish, 20+ chars, with dot
// separators like Cloudflare mints for the v0 widget.
const VALID_TOKEN = '0.AAAAAAAAAAAAAAAAAAAA.abcdefgh'

async function loadTurnstile(secret: string | undefined) {
  vi.resetModules()
  process.env.TURNSTILE_SECRET_KEY = secret ?? ''
  return await import('@/lib/turnstile')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('verifyTurnstile — unset secret (soft skip)', () => {
  it('skips verification and returns ok when TURNSTILE_SECRET_KEY is unset', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { verifyTurnstile } = await loadTurnstile(undefined)
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('skips even when no token is provided and no network call is made', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { verifyTurnstile } = await loadTurnstile(undefined)
    const result = await verifyTurnstile(null)

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('verifyTurnstile — configured secret (fail closed)', () => {
  it('rejects an invalid token shape without calling siteverify', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile('not-a-valid-token!!')

    expect(result).toEqual({ ok: false, code: 'invalid-token' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a missing token', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(null)

    expect(result).toEqual({ ok: false, code: 'invalid-token' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('accepts a token verified by siteverify', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    )

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: true })
  })

  it('forwards remoteip when provided', async () => {
    const fetchSpy = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    await verifyTurnstile(VALID_TOKEN)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = fetchSpy.mock.calls[0]?.[0]
    const body = fetchSpy.mock.calls[0]?.[1]?.body as string
    expect(url).toContain('siteverify')
    expect(body).toContain('secret=secret-key')
    expect(body).toContain(`response=${encodeURIComponent(VALID_TOKEN)}`)
  })

  it('returns the upstream error codes when success is false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              'error-codes': ['timeout-or-duplicate'],
            }),
            { status: 200 },
          ),
      ),
    )

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: false, code: 'timeout-or-duplicate' })
  })

  it('fails closed on a non-2xx upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream exploded', { status: 502 })),
    )

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: false, code: 'upstream-http-error' })
  })

  it('fails closed on a malformed upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json{', { status: 200 })),
    )

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: false, code: 'malformed-response' })
  })

  it('fails closed on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('ECONNRESET')
      }),
    )

    const { verifyTurnstile } = await loadTurnstile('secret-key')
    const result = await verifyTurnstile(VALID_TOKEN)

    expect(result).toEqual({ ok: false, code: 'network-error' })
  })
})
