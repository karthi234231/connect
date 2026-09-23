import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token'
process.env.ABLY_API_KEY = 'ably-key'
process.env.RESEND_API_KEY = 'resend-key'
process.env.CSRF_SECRET = 'test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60_000,
  })),
  logCspViolation: vi.fn(),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  authIpRatelimit: {},
  getRateLimitHeaders: () => ({}),
}))
vi.mock('@/lib/security', () => ({ logCspViolation: mocks.logCspViolation }))
vi.mock('@/lib/auth', () => ({ getRequestId: () => 'test-request' }))

import { POST } from '@/app/api/security/csp-report/route'

describe('POST /api/security/csp-report', () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockClear()
    mocks.logCspViolation.mockClear()
  })

  it('accepts a browser CSP report and returns 204', async () => {
    const request = new Request('http://localhost/api/security/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': 'http://localhost/',
          'blocked-uri': 'inline',
        },
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(204)
    expect(mocks.logCspViolation).toHaveBeenCalledOnce()
  })
})
