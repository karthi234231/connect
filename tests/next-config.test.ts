// tests/next-config.test.ts
// The response security headers are the app's outermost control, and nothing
// else in the suite exercises `next.config.mjs`. These tests fail the build if
// a header is dropped or if HSTS ever leaks into a development environment.
import { afterEach, describe, expect, it, vi } from 'vitest'

interface HeaderEntry {
  key: string
  value: string
}

interface HeaderRule {
  source: string
  headers: HeaderEntry[]
}

interface LoadedConfig {
  poweredByHeader?: boolean
  headers: () => Promise<HeaderRule[]>
}

async function loadConfig(): Promise<LoadedConfig> {
  vi.resetModules()
  const imported = await import('../next.config.mjs')
  return imported.default as LoadedConfig
}

function toMap(headers: HeaderEntry[]): Record<string, string> {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]))
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('next.config.mjs — response hardening', () => {
  it('applies the hardening headers to every route', async () => {
    const config = await loadConfig()
    const rules = await config.headers()
    const catchAll = rules.find((rule) => rule.source === '/:path*')

    expect(catchAll).toBeDefined()
    const headers = toMap(catchAll!.headers)

    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none')
    expect(headers['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    )
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'")
    expect(headers['Content-Security-Policy']).toContain("base-uri 'self'")
  })

  it('never caches API responses in a shared cache', async () => {
    const config = await loadConfig()
    const rules = await config.headers()
    const apiRule = rules.find((rule) => rule.source === '/api/:path*')

    expect(apiRule).toBeDefined()
    expect(toMap(apiRule!.headers)['Cache-Control']).toContain('no-store')
  })

  it('does not advertise the framework', async () => {
    const config = await loadConfig()
    expect(config.poweredByHeader).toBe(false)
  })

  it('omits HSTS in development (it would poison http://localhost)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const config = await loadConfig()
    const rules = await config.headers()
    const headers = toMap(
      rules.find((rule) => rule.source === '/:path*')!.headers,
    )

    expect(headers['Strict-Transport-Security']).toBeUndefined()
    // Turbopack needs eval + an HMR socket to render anything in dev.
    expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'")
  })

  it('enables HSTS and drops the eval allowance in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const config = await loadConfig()
    const rules = await config.headers()
    const headers = toMap(
      rules.find((rule) => rule.source === '/:path*')!.headers,
    )

    expect(headers['Strict-Transport-Security']).toContain('max-age=')
    expect(headers['Content-Security-Policy']).not.toContain("'unsafe-eval'")
    expect(headers['Content-Security-Policy']).toContain(
      'upgrade-insecure-requests',
    )
  })

  it('survives a malformed Supabase URL instead of crashing the build', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
    const config = await loadConfig()
    const rules = await config.headers()
    const headers = toMap(
      rules.find((rule) => rule.source === '/:path*')!.headers,
    )

    expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
    expect(headers['Content-Security-Policy']).not.toContain('not-a-url')
  })
})
