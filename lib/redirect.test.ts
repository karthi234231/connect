// lib/redirect.test.ts
// HOST-AUTH-06: `isSafeRedirectUrl` is the single open-redirect guard used by
// the proxy, the OAuth callback and the login form. Every historically
// dangerous shape gets a regression test.
import { describe, expect, it } from 'vitest'

import { isSafeRedirectUrl } from '@/lib/redirect'

describe('isSafeRedirectUrl', () => {
  it('accepts same-origin absolute paths', () => {
    expect(isSafeRedirectUrl('/')).toBe(true)
    expect(isSafeRedirectUrl('/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('/dashboard/events?tab=upcoming#top')).toBe(true)
    expect(isSafeRedirectUrl('/settings/security')).toBe(true)
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeRedirectUrl('https://evil.example')).toBe(false)
    expect(isSafeRedirectUrl('http://evil.example/path')).toBe(false)
    expect(isSafeRedirectUrl('//evil.example')).toBe(false)
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeRedirectUrl('data:text/html,<script>1</script>')).toBe(false)
  })

  it('rejects backslash-based origin confusion', () => {
    expect(isSafeRedirectUrl('/\\evil.example')).toBe(false)
    expect(isSafeRedirectUrl('/path\\to')).toBe(false)
    expect(isSafeRedirectUrl('/%5Cevil.example')).toBe(false)
    expect(isSafeRedirectUrl('/%5cevil.example')).toBe(false)
  })

  it('rejects percent-encoded slashes that could re-introduce traversal', () => {
    expect(isSafeRedirectUrl('/..%2f..%2fetc/passwd')).toBe(false)
    expect(isSafeRedirectUrl('/..%2F..%2Fetc/passwd')).toBe(false)
  })

  it('rejects header-splitting control characters', () => {
    expect(isSafeRedirectUrl('/dashboard\r\nSet-Cookie: a=b')).toBe(false)
    expect(isSafeRedirectUrl('/dashboard\nX-Injected: 1')).toBe(false)
  })

  it('rejects empty and relative values', () => {
    expect(isSafeRedirectUrl('')).toBe(false)
    expect(isSafeRedirectUrl('dashboard')).toBe(false)
    expect(isSafeRedirectUrl('?next=/dashboard')).toBe(false)
  })
})
