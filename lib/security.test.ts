// lib/security.test.ts
import { describe, it, expect } from 'vitest'

import { safeCompare } from '@/lib/security'

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('a', 'a')).toBe(true)
  })

  it('returns false for different strings of same length', () => {
    expect(safeCompare('a', 'b')).toBe(false)
  })

  it('returns false for differing lengths without throwing', () => {
    expect(safeCompare('a', 'ab')).toBe(false)
    expect(safeCompare('ab', 'a')).toBe(false)
    expect(safeCompare('', 'a')).toBe(false)
    expect(safeCompare('a', '')).toBe(false)
  })

  it('returns correct bool for very long strings where first bytes differ', () => {
    const longA = 'a'.repeat(10000)
    const longB = 'b' + 'a'.repeat(9999)
    expect(safeCompare(longA, longB)).toBe(false)
  })

  it('returns true for very long identical strings', () => {
    const long = 'x'.repeat(10000)
    expect(safeCompare(long, long)).toBe(true)
  })

  it('returns false for very long strings of different lengths', () => {
    const longA = 'a'.repeat(10000)
    const longB = 'a'.repeat(9999)
    expect(safeCompare(longA, longB)).toBe(false)
  })

  it('returns false for inputs that only differ by a trailing NUL byte', () => {
    // Regression: the previous zero-padding implementation mapped these onto
    // identical padded buffers and compared equal (trailing-NUL collapse).
    expect(safeCompare('a\u0000', 'a')).toBe(false)
    expect(safeCompare('a', 'a\u0000')).toBe(false)
    expect(safeCompare('\u0000', '')).toBe(false)
    expect(safeCompare('token\u0000\u0000', 'token')).toBe(false)
  })

  it('compares multi-byte and locale-sensitive secrets byte-exactly', () => {
    expect(safeCompare('pässwörd', 'pässwörd')).toBe(true)
    expect(safeCompare('pässwörd', 'passwörd')).toBe(false)
    // NFC vs NFD are different byte sequences → different secrets.
    expect(safeCompare('\u00e9', 'e\u0301')).toBe(false)
  })

  it('never throws for empty or length-mismatched secrets', () => {
    expect(() => safeCompare('', '')).not.toThrow()
    expect(safeCompare('', '')).toBe(true)
    expect(() => safeCompare('x'.repeat(4096), '')).not.toThrow()
  })
})
