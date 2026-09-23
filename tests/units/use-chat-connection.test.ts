// tests/units/use-chat-connection.test.ts
// Regression guard for the chat connection posture. The hook itself only wires
// Ably events into `resolveComposerConnectionState`, so the testable contract is
// the pure resolver (DOM-free, matching the repo's Vitest style — no
// @testing-library/react dependency is available or needed here).

import { describe, expect, it } from 'vitest'
import { resolveComposerConnectionState } from '@/lib/chat/connection'

describe('useChatConnection — connection state resolution', () => {
  it('resolves to online when a token exists and the socket is connected', () => {
    expect(
      resolveComposerConnectionState({ hasToken: true, isConnected: true }),
    ).toBe('online')
  })

  it('resolves to reconnecting when a token exists but the socket dropped', () => {
    // Ably `disconnected` / `suspended` → token held, socket down, auto-recovers.
    expect(
      resolveComposerConnectionState({ hasToken: true, isConnected: false }),
    ).toBe('reconnecting')
  })

  it('resolves to connecting when no token is held (initial handshake / failed)', () => {
    // Before the token action resolves, and after an Ably `failed` event.
    expect(
      resolveComposerConnectionState({ hasToken: false, isConnected: false }),
    ).toBe('connecting')
  })
})
