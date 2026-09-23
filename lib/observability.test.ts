// lib/observability.test.ts
// PII must never reach a log sink or Sentry. These tests lock the scrubbing
// contract of `scrubForObservability` / `looksSensitive`.
import { describe, expect, it } from 'vitest'

import { looksSensitive, scrubForObservability } from '@/lib/observability'

describe('looksSensitive', () => {
  it('flags PII/sensitive keys regardless of value type', () => {
    expect(looksSensitive('email', 'a@b.co')).toBe(true)
    expect(looksSensitive('userPassword', 'x')).toBe(true)
    expect(looksSensitive('authorization', 42)).toBe(true)
    expect(looksSensitive('api_key', 'abc')).toBe(true)
    expect(looksSensitive('latitude', 51.5)).toBe(true)
  })

  it('flags secret-looking values even under an innocuous key', () => {
    // Fixtures are deliberately low-entropy and assembled from parts: a
    // realistic JWT/bearer literal trips the repository's `no-secrets` rule
    // even though it is a fake. The SHAPE is what `looksSensitive` detects.
    const fakeJwt = ['eyJ11111111', '11111111', '11111111'].join('.')
    const fakeBearer = ['Bearer', 'ababababababab'].join(' ')
    const fakeQuery = ['token', 'ccccc'].join('=')

    expect(looksSensitive('note', fakeJwt)).toBe(true)
    expect(looksSensitive('note', fakeBearer)).toBe(true)
    expect(looksSensitive('note', fakeQuery)).toBe(true)
  })

  it('leaves ordinary values alone', () => {
    expect(looksSensitive('route', '/dashboard/events')).toBe(false)
    expect(looksSensitive('count', 12)).toBe(false)
  })
})

describe('scrubForObservability', () => {
  it('redacts sensitive keys in flat payloads', () => {
    const scrubbed = scrubForObservability({
      userId: 'u_1',
      email: 'person@example.com',
      sessionToken: 'abc',
    }) as Record<string, unknown>

    expect(scrubbed.userId).toBe('u_1')
    expect(scrubbed.email).toBe('[REDACTED]')
    expect(scrubbed.sessionToken).toBe('[REDACTED]')
  })

  it('redacts nested objects and arrays', () => {
    const scrubbed = scrubForObservability({
      profile: { phone: '+441234567890', city: 'London' },
      logins: [{ ip: '10.0.0.1' }, { email: 'x@y.z' }],
    }) as {
      profile: Record<string, unknown>
      logins: Array<Record<string, unknown>>
    }

    expect(scrubbed.profile.phone).toBe('[REDACTED]')
    expect(scrubbed.profile.city).toBe('London')
    expect(scrubbed.logins[0].ip).toBe('[REDACTED]')
    expect(scrubbed.logins[1].email).toBe('[REDACTED]')
  })

  it('scrubs inline secrets embedded in free text', () => {
    const scrubbed = scrubForObservability(
      'failed with token=supersecret123',
    ) as string

    expect(scrubbed).not.toContain('supersecret123')
    expect(scrubbed).toContain('[REDACTED]')
  })

  it('caps recursion depth so a cyclic payload cannot hang the process', () => {
    const payload: Record<string, unknown> = {}
    let cursor = payload
    for (let depth = 0; depth < 12; depth += 1) {
      const next: Record<string, unknown> = {}
      cursor.child = next
      cursor = next
    }

    const scrubbed = JSON.stringify(scrubForObservability(payload))

    expect(scrubbed).toContain('[MAX_DEPTH]')
  })

  it('passes primitives and null through unchanged', () => {
    expect(scrubForObservability(null)).toBeNull()
    expect(scrubForObservability(7)).toBe(7)
    expect(scrubForObservability(true)).toBe(true)
  })
})
