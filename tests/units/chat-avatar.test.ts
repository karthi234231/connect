// tests/units/chat-avatar.test.ts
// Regression coverage for lib/chat/avatar.ts: initials (incl. astral/combining
// chars, whitespace, long names) and the deterministic pastel tone.

import { describe, expect, it } from 'vitest'
import { avatarTone, getInitials } from '@/lib/chat/avatar'

const ALLOWED_TONES = [
  'bg-amber-200',
  'bg-rose-200',
  'bg-sky-200',
  'bg-violet-200',
  'bg-emerald-200',
]

/** True when a string contains an *unpaired* surrogate half (broken render). */
function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      i += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}

describe('getInitials', () => {
  it('returns the first char of the first and last word, uppercased', () => {
    expect(getInitials('Maya Okafor')).toBe('MO')
    expect(getInitials('john doe')).toBe('JD')
    expect(getInitials('ana maria silva lopez')).toBe('AL')
  })

  it('collapses extra and non-breaking whitespace', () => {
    expect(getInitials('  maya   okafor  ')).toBe('MO')
    expect(getInitials('Maya\u00A0Okafor')).toBe('MO')
    expect(getInitials('\uFEFFMaya Okafor')).toBe('MO')
    expect(getInitials('Maya\tOkafor\n')).toBe('MO')
  })

  it('returns a single initial for a one-word name', () => {
    expect(getInitials('Maya')).toBe('M')
    expect(getInitials('maya')).toBe('M')
  })

  it('handles single-character names', () => {
    expect(getInitials('A')).toBe('A')
    expect(getInitials('a')).toBe('A')
    expect(getInitials('A B')).toBe('AB')
  })

  it('keeps accents in initials', () => {
    expect(getInitials('Élodie Roux')).toBe('ÉR')
    expect(getInitials('Jörg Müller')).toBe('JM')
  })

  it('treats NFC and NFD spellings of a name identically', () => {
    expect(getInitials('Élodie Roux')).toBe(getInitials('E\u0301lodie Roux'))
    expect(getInitials('E\u0301lodie Roux')).toBe('ÉR')
  })

  it('skips leading combining marks and returns the base letter', () => {
    expect(getInitials('\u0301Alex Doe')).toBe('AD')
  })

  it('never emits a lone surrogate for emoji names', () => {
    expect(hasLoneSurrogate(getInitials('😀'))).toBe(false)
    expect(getInitials('😀')).toBe('😀')
    expect(getInitials('😀 Jones')).toBe('😀J')
    expect(hasLoneSurrogate(getInitials('😀 Jones'))).toBe(false)
    expect(getInitials('Ada 🎧')).toBe('A🎧')
  })

  it('keeps astral initials whole across ZWJ sequences', () => {
    const initials = getInitials('👨‍👩‍👧 Family')
    expect([...initials]).toEqual(['👨', 'F'])
    expect(hasLoneSurrogate(initials)).toBe(false)
  })

  it('returns a clean initial for emoji-modifier-led words', () => {
    expect(getInitials('👩🏽 Dev')).toBe('👩D')
  })

  it('returns first + last initial for very long names', () => {
    const long = Array.from(
      { length: 100 },
      (_, i) => `Word${i}`,
    ).join(' ')
    expect(getInitials(long)).toBe('W' + 'Word99'.charAt(0).toUpperCase())
    expect(getInitials(long)).toBe('WW')
  })

  it('falls back for empty/whitespace/null/undefined input', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials('   ')).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })

  it('uses the custom fallback and uppercases initials', () => {
    expect(getInitials('', '—')).toBe('—')
    expect(getInitials('jj oo')).toBe('JO')
  })
})

describe('avatarTone', () => {
  it('is deterministic across invocations for the same seed', () => {
    expect(avatarTone('Maya Okafor')).toBe(avatarTone('Maya Okafor'))
    expect(avatarTone('😀 Jones')).toBe(avatarTone('😀 Jones'))
    expect(avatarTone('')).toBe(avatarTone(''))
  })

  it('maps NFC/NFD spellings of the same name to the same tone', () => {
    expect(avatarTone('Élodie')).toBe(avatarTone('E\u0301lodie'))
  })

  it('always returns an allowed tone', () => {
    for (const seed of [
      null,
      undefined,
      '',
      'u-77',
      'Maya Okafor',
      '😀 Jones',
      'x'.repeat(1000),
    ]) {
      expect(ALLOWED_TONES).toContain(avatarTone(seed as string | null))
    }
  })

  it('is deterministic for an orphan-peer user id', () => {
    expect(avatarTone('u-77')).toBe(avatarTone('u-77'))
  })
})