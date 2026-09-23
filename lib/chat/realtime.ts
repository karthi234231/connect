// src/lib/chat/realtime.ts
// S032 — Typed Ably channel event protocol for chat.
// Messages are the persisted source of truth; realtime is a delivery
// accelerator. Typing/presence are ephemeral and never persisted.

export const CHAT_EVENT_VERSION = 1

export type ChatRealtimeEventType =
  'message' | 'typing' | 'receipt' | 'reaction'

export interface ChatEventEnvelope<T = unknown> {
  eventId: string
  type: ChatRealtimeEventType
  actorId: string
  conversationId: string
  createdAt: string
  version: number
  payload: T
}

export interface TypingPayload {
  isTyping: boolean
}

export interface ReceiptPayload {
  matchId: string
  readerId: string
  readAt: string
}

export interface MessagePayload {
  matchId: string
  id: string
  senderId: string
  content: string
  createdAt: string
}

const EVENT_KEYS = [
  'eventId',
  'type',
  'actorId',
  'conversationId',
  'createdAt',
  'version',
  'payload',
] as const

export function isChatEvent(value: unknown): value is ChatEventEnvelope {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  for (const key of EVENT_KEYS) {
    if (!(key in record)) return false
  }
  return (
    record.type === 'message' ||
    record.type === 'typing' ||
    record.type === 'receipt' ||
    record.type === 'reaction'
  )
}

export function isTypingEvent(
  value: unknown,
): value is ChatEventEnvelope<TypingPayload> {
  return (
    isChatEvent(value) &&
    value.type === 'typing' &&
    typeof (value.payload as TypingPayload)?.isTyping === 'boolean'
  )
}

export function isReceiptEvent(
  value: unknown,
): value is ChatEventEnvelope<ReceiptPayload> {
  if (!isChatEvent(value) || value.type !== 'receipt') return false
  const payload = value.payload as ReceiptPayload
  return (
    typeof payload?.matchId === 'string' &&
    typeof payload?.readerId === 'string' &&
    typeof payload?.readAt === 'string'
  )
}

export function buildReceiptEnvelope(params: {
  eventId: string
  actorId: string
  conversationId: string
  payload: ReceiptPayload
}): ChatEventEnvelope<ReceiptPayload> {
  return {
    eventId: params.eventId,
    type: 'receipt',
    actorId: params.actorId,
    conversationId: params.conversationId,
    createdAt: new Date().toISOString(),
    version: CHAT_EVENT_VERSION,
    payload: params.payload,
  }
}

export function isMessageEvent(
  value: unknown,
): value is ChatEventEnvelope<MessagePayload> {
  if (!isChatEvent(value)) return false
  const payload = value.payload as MessagePayload
  return (
    value.type === 'message' &&
    typeof payload?.id === 'string' &&
    typeof payload?.content === 'string'
  )
}

export function buildTypingEnvelope(params: {
  eventId: string
  actorId: string
  conversationId: string
  isTyping: boolean
}): ChatEventEnvelope<TypingPayload> {
  return {
    eventId: params.eventId,
    type: 'typing',
    actorId: params.actorId,
    conversationId: params.conversationId,
    createdAt: new Date().toISOString(),
    version: CHAT_EVENT_VERSION,
    payload: { isTyping: params.isTyping },
  }
}

export function buildMessageEnvelope(params: {
  eventId: string
  actorId: string
  conversationId: string
  message: MessagePayload
}): ChatEventEnvelope<MessagePayload> {
  return {
    eventId: params.eventId,
    type: 'message',
    actorId: params.actorId,
    conversationId: params.conversationId,
    createdAt: new Date().toISOString(),
    version: CHAT_EVENT_VERSION,
    payload: params.message,
  }
}

// Session 31 — reaction event contract (§343). The server stays the storage
// authority; this envelope is a delivery accelerator so the peer converges
// without waiting for a refetch. `active: true` replaces any prior emoji from
// the actor (storage holds one reaction per (message, user)).
export interface ReactionPayload {
  messageId: string
  userId: string
  /** Allowlisted reaction emoji (MESSAGE_REACTIONS). */
  emoji: string
  /** true = add (replace-first), false = remove. */
  active: boolean
}

export function isReactionEvent(
  value: unknown,
): value is ChatEventEnvelope<ReactionPayload> {
  if (!isChatEvent(value) || value.type !== 'reaction') return false
  const payload = value.payload as ReactionPayload
  return (
    typeof payload?.messageId === 'string' &&
    typeof payload?.userId === 'string' &&
    typeof payload?.emoji === 'string' &&
    typeof payload?.active === 'boolean'
  )
}

export function buildReactionEnvelope(params: {
  eventId: string
  actorId: string
  conversationId: string
  reaction: ReactionPayload
}): ChatEventEnvelope<ReactionPayload> {
  return {
    eventId: params.eventId,
    type: 'reaction',
    actorId: params.actorId,
    conversationId: params.conversationId,
    createdAt: new Date().toISOString(),
    version: CHAT_EVENT_VERSION,
    payload: params.reaction,
  }
}

export function compareChatMessages(
  a: MessagePayload,
  b: MessagePayload,
): number {
  if (a.createdAt < b.createdAt) return -1
  if (a.createdAt > b.createdAt) return 1
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

/**
 * S27 — canonical realtime merge. messageId is the identity; the optimistic
 * row (id `optimistic-<clientMessageId>`) is replaced when the authoritative
 * row arrives. Keys: (1) result id equals an existing row → update; (2) an
 * optimistic row with the same sender+content and no persisted id yet → swap.
 * New rows insert in sort position. Returns the input list unchanged when the
 * id is already present (duplicate realtime event: ignore).
 */
/**
 * S27 — pure merge helper: messageId canonical, optimistic row replaced,
 * duplicates ignored, `createdAt ASC, id ASC` maintained.
 */
export function mergeRealtimeMessage<T extends MessagePayload>(
  current: readonly T[],
  incoming: T,
  toPayload: (message: T) => MessagePayload = (message) => message,
): T[] {
  const existingIndex = current.findIndex((message) => {
    const payload = toPayload(message)
    if (payload.id === incoming.id) return true
    if (
      payload.id.startsWith('optimistic-') &&
      payload.senderId === incoming.senderId &&
      payload.content === incoming.content
    ) {
      return true
    }
    return false
  })

  if (existingIndex >= 0) {
    const existing = toPayload(current[existingIndex] as T)
    if (existing.id === incoming.id) return current as T[]
    const next = [...current]
    next[existingIndex] = incoming
    // Re-sort on replacement: authoritative createdAt may differ from the optimistic one.
    return next.sort((a, b) => compareChatMessages(toPayload(a), toPayload(b)))
  }

  return [...current, incoming].sort((a, b) =>
    compareChatMessages(toPayload(a), toPayload(b)),
  )
}

/**
 * Normalize an inbound Ably "message" payload into a MessagePayload.
 * Accepts the typed envelope (S032) and the legacy raw Message shape for
 * back-compat with any existing publisher.
 */
export function decodeMessageEvent(data: unknown): MessagePayload | null {
  if (isMessageEvent(data)) return data.payload
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (
    typeof m.id === 'string' &&
    typeof m.content === 'string' &&
    typeof m.senderId === 'string'
  ) {
    return {
      matchId: typeof m.matchId === 'string' ? m.matchId : '',
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      createdAt:
        typeof m.createdAt === 'string'
          ? m.createdAt
          : new Date().toISOString(),
    }
  }
  return null
}
