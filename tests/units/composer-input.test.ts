// tests/units/composer-input.test.ts
// Regression guard for the client-side send affordance rules
// (lib/chat/composer-input.ts). The composer must agree with the server
// schema: 2000-char content cap (DB parity with messages.content) and a send
// only when there is real text or a queued attachment.

import { describe, expect, it } from 'vitest'
import {
  canSubmitDraft,
  cleanComposerText,
  COMPOSER_MAX_CHARS,
} from '@/lib/chat/composer-input'

describe('composer-input — draft rules', () => {
  it('matches the server content cap (DB parity for messages.content)', () => {
    expect(COMPOSER_MAX_CHARS).toBe(2000)
  })

  it('trims surrounding whitespace before a send is considered', () => {
    expect(cleanComposerText('  hello  ')).toBe('hello')
    expect(cleanComposerText('   ')).toBe('')
  })

  it('requires text OR an attachment to enable the send affordance', () => {
    expect(canSubmitDraft('', false)).toBe(false)
    expect(canSubmitDraft('   ', false)).toBe(false)
    expect(canSubmitDraft('hello', false)).toBe(true)
    expect(canSubmitDraft('', true)).toBe(true)
    expect(canSubmitDraft('hello', true)).toBe(true)
  })
})