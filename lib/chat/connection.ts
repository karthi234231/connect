// src/lib/chat/connection.ts
// V10-FE-02 — connection-posture resolution for the chat composer. Kept pure so
// the connecting/reconnecting/online discrimination is unit-testable without a
// DOM.

// Real-time connection posture for the chat presence engine. Kept pure so the
// connecting/reconnecting/online discrimination is unit-testable without a DOM.
// The UI no longer renders any online/offline indicator for chat; this type now
// lives here (it is only consumed by the connection hook and its tests).

export type ComposerConnectionState = 'connecting' | 'reconnecting' | 'online'

export interface RealtimeConnectionInput {
  /** Real-time channel authentic tautology materialized. */
  hasToken: boolean
  /** Real-time channel reports connected. */
  isConnected: boolean
}

/**
 * Pure boolean gate for the "composer online" affordance — real-time presence
 * is usable only while a token is held AND the socket is connected.
 */
export function isComposerOnline(input: RealtimeConnectionInput): boolean {
  return input.hasToken && input.isConnected
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
  if (isComposerOnline({ hasToken, isConnected })) {
    return 'online'
  }

  return hasToken ? 'reconnecting' : 'connecting'
}
