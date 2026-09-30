// tests/units/chat-pure-libs.test.ts
// Focused regression coverage for the three small chat pure libs:
// composer-input (draft rules + placeholder), message-state (optimistic ids +
// delivery states incl. failed), and connection (3-state composer posture).

import { describe, expect, it } from 'vitest'
import {
  buildComposerPlaceholder,
  canSubmitDraft,
  cleanComposerText,
  COMPOSER_MAX_CHARS,
} from '@/lib/chat/composer-input'
import {
  buildOptimisticId,
  deriveMessageState,
  extractClientMessageId,
  isOptimisticId,
  MESSAGE_STATE_LABEL,
  OPTIMISTIC_PREFIX,
  type MessageDeliveryState,
} from '@/lib/chat/message-state'
import {
  isComposerOnline,
  resolveComposerConnectionState,
} from '@/lib/chat/connection'

describe('composer-input — draft rules', () => {
  it('keeps the DB-parity content cap at 2000 chars', () => {
    expect(COMPOSER_MAX_CHARS).toBe(2000)
  })

  it('keeps cleanComposerText as a trim-only transform (server byte parity)', () => {
    expect(cleanComposerText('  hello  \n')).toBe('hello')
    expect(cleanComposerText(' \t \n ')).toBe('')
    expect(cleanComposerText('already-clean')).toBe('already-clean')
  })

  it('enables a send only with real text or a queued attachment', () => {
    expect(canSubmitDraft('', false)).toBe(false)
    expect(canSubmitDraft('   ', false)).toBe(false)
    expect(canSubmitDraft('hello', false)).toBe(true)
    expect(canSubmitDraft('', true)).toBe(true)
    expect(canSubmitDraft('hello', true)).toBe(true)
  })
})

describe('composer-input — buildComposerPlaceholder', () => {
  it('personalizes with the peer first name when known', () => {
    expect(buildComposerPlaceholder('Ada')).toBe('Message Ada\u2026')
    expect(buildComposerPlaceholder('  Ada  ')).toBe('Message Ada\u2026')
  })

  it('falls back to the generic prompt when the name is absent', () => {
    expect(buildComposerPlaceholder()).toBe('Type a message\u2026')
    expect(buildComposerPlaceholder(null)).toBe('Type a message\u2026')
    expect(buildComposerPlaceholder('')).toBe('Type a message\u2026')
    expect(buildComposerPlaceholder('   ')).toBe('Type a message\u2026')
  })
})

describe('message-state — optimistic ids', () => {
  it('round-trips a client id through buildOptimisticId / extractClientMessageId', () => {
    const id = buildOptimisticId('client-1')
    expect(id).toBe(`${OPTIMISTIC_PREFIX}client-1`)
    expect(isOptimisticId(id)).toBe(true)
    expect(extractClientMessageId(id)).toBe('client-1')
  })

  it('does not treat plain ids as optimistic', () => {
    expect(isOptimisticId('client-1')).toBe(false)
    expect(extractClientMessageId('client-1')).toBeNull()
    expect(extractClientMessageId('prefix-optimistic-1')).toBeNull()
  })
})

describe('message-state — deriveMessageState', () => {
  it('reports sending for an optimistic (pending) id', () => {
    expect(
      deriveMessageState({
        id: buildOptimisticId('client-1'),
        readAt: null,
      }),
    ).toBe('sending')
  })

  it('keeps an optimistic row as sending even when readAt is set', () => {
    expect(
      deriveMessageState({
        id: buildOptimisticId('client-1'),
        readAt: '2026-09-24T10:00:00Z',
      }),
    ).toBe('sending')
  })

  it('reports sent for a confirmed non-read message', () => {
    expect(deriveMessageState({ id: 'msg-1', readAt: null })).toBe('sent')
  })

  it('reports read once readAt is set on a confirmed id', () => {
    expect(
      deriveMessageState({
        id: 'msg-1',
        readAt: '2026-09-24T10:00:00Z',
      }),
    ).toBe('read')
  })

  it('returns failed and overrides every other signal', () => {
    expect(
      deriveMessageState(
        { id: 'msg-1', readAt: '2026-09-24T10:00:00Z' },
        { failed: true },
      ),
    ).toBe('failed')
    expect(
      deriveMessageState(
        { id: buildOptimisticId('client-1'), readAt: null },
        { failed: true },
      ),
    ).toBe('failed')
  })
})

describe('message-state — MESSAGE_STATE_LABEL', () => {
  it('covers all four delivery states with a readable label', () => {
    const states: MessageDeliveryState[] = [
      'sending',
      'sent',
      'read',
      'failed',
    ]
    expect(Object.keys(MESSAGE_STATE_LABEL)).toHaveLength(states.length)
    for (const state of states) {
      expect(MESSAGE_STATE_LABEL[state].length).toBeGreaterThan(0)
    }
    expect(MESSAGE_STATE_LABEL.failed).toBe('Not delivered')
  })
})

describe('connection — composer posture', () => {
  it('resolves online when a token is held and the socket is connected', () => {
    expect(
      resolveComposerConnectionState({ hasToken: true, isConnected: true }),
    ).toBe('online')
    expect(isComposerOnline({ hasToken: true, isConnected: true })).toBe(true)
  })

  it('resolves reconnecting when the token is held but the socket dropped', () => {
    expect(
      resolveComposerConnectionState({ hasToken: true, isConnected: false }),
    ).toBe('reconnecting')
    expect(isComposerOnline({ hasToken: true, isConnected: false })).toBe(false)
  })

  it('resolves connecting when no token is held (initial handshake / failed)', () => {
    expect(
      resolveComposerConnectionState({ hasToken: false, isConnected: false }),
    ).toBe('connecting')
    expect(
      resolveComposerConnectionState({ hasToken: false, isConnected: true }),
    ).toBe('connecting')
    expect(isComposerOnline({ hasToken: false, isConnected: true })).toBe(false)
  })

  it('docstring parity: the two boolean flags collapse to exactly the documented three states (no offline)', () => {
    const outcomes = [
      { hasToken: false, isConnected: false },
      { hasToken: false, isConnected: true },
      { hasToken: true, isConnected: false },
      { hasToken: true, isConnected: true },
    ].map((input) => resolveComposerConnectionState(input))
    expect(new Set(outcomes)).toEqual(
      new Set(['connecting', 'reconnecting', 'online']),
    )
  })
})