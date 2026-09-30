// src/lib/chat/message-state.ts
// S033 — Typed, honest message delivery state.
// States: sending → sent → read (failed on send error). There is NO "delivered"
// state: we have no device-level delivery guarantee, so we never claim one.

import type { Message } from '@/services/chat/mappers'

export const OPTIMISTIC_PREFIX = 'optimistic-'

export type MessageDeliveryState = 'sending' | 'sent' | 'read' | 'failed'

/** Screen-reader labels for state changes (no color-only signal). */
export const MESSAGE_STATE_LABEL: Record<MessageDeliveryState, string> = {
  sending: 'Sending',
  sent: 'Sent',
  read: 'Read',
  failed: 'Not delivered',
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX)
}

/** Wrap a client idempotency key in the optimistic placeholder namespace. */
export function buildOptimisticId(clientMessageId: string): string {
  return `${OPTIMISTIC_PREFIX}${clientMessageId}`
}

/** Recovers the idempotency key from an optimistic message id (for retry). */
export function extractClientMessageId(id: string): string | null {
  if (!isOptimisticId(id)) return null
  return id.slice(OPTIMISTIC_PREFIX.length)
}

/**
 * Minimal tick-glyph view-model for a status row. UI agents map `kind` to a
 * single tick (sent), double tick (read), spinner (sending), or a retry
 * affordance (failed).
 */
export type MessageStatusView =
  | { kind: 'sending'; label: string }
  | { kind: 'sent'; label: string }
  | { kind: 'read'; label: string }
  | { kind: 'failed'; label: string; retriable: true }

/**
 * Derive the visible state for one of the VIEWER'S OWN messages. Receipt
 * ticks are only meaningful for your own sends, so callers must skip peer
 * messages before invoking this (the sender is not among the inputs).
 * `failed` overrides everything: an errored send stays failed until retried.
 */
export function deriveMessageState(
  message: Pick<Message, 'id' | 'readAt'>,
  opts: { failed?: boolean } = {},
): MessageDeliveryState {
  if (opts.failed) return 'failed'
  if (isOptimisticId(message.id)) return 'sending'
  if (message.readAt) return 'read'
  return 'sent'
}
