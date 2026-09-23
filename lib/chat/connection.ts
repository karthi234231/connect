// src/lib/chat/connection.ts
// V10-FE-02 — connection-posture resolution for the chat composer. Kept pure so
// the offline/reconnecting/online discrimination is unit-testable without a DOM.

import type { ComposerConnectionState } from '@/components/chat'

export interface RealtimeConnectionInput {
  /** Real-time channel authentic tautology materialized. */
  hasToken: boolean
  /** Real-time channel reports connected. */
  isConnected: boolean
}

/**
 * Resolve the composer's connection posture from the realtime channel signals.
 *
 * Semantics (matches the header's `isOnline` = has-token AND connected-):
 * - online:  channel is usable for presence/typing.
 * - reconnecting:  we have a token but the socket dropped — will recover automatically.
 * - connecting:  no token yet — initial handshake in flight.
 *
 * A non-online channel must NOT gate actual message sending, which goes over
 * the authoritative HTTP action; only a locked thread does (handled upstream).
 */
export function resolveComposerConnectionState({
  hasToken,
  isConnected,
}: RealtimeConnectionInput): ComposerConnectionState {
  if (hasToken && isConnected) {
    return 'online'
  }

  return hasToken ? 'reconnecting' : 'connecting'
}
