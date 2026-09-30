// src/lib/chat/realtime.ts
// S032 — Typed Ably channel event protocol for chat.
// Messages are the persisted source of truth; realtime is a delivery
// accelerator. Typing/presence are ephemeral and never persisted.

export const CHAT_EVENT_VERSION = 1

/**
 * Provisional placeholder prefix. Optimistic rows are ided
 * `optimistic-<clientMessageId>` until the server echo swaps in the real id.
 */
export const OPTIMISTIC_ID_PREFIX = 'optimistic-'

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
  /**
   * Client minted idempotency key. Set on optimistic rows
   * (`id = optimistic-<clientMessageId>`) and on persisted rows that carry it,
   * so a server echo can be correlated to its exact placeholder instead of the
   * (senderId, content) short-form heuristic.
   */
  clientMessageId?: string
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
    typeof record.eventId === 'string' &&
    typeof record.actorId === 'string' &&
    typeof record.conversationId === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.version === 'number' &&
    (record.type === 'message' ||
      record.type === 'typing' ||
      record.type === 'receipt' ||
      record.type === 'reaction')
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
  if (!isChatEvent(value) || value.type !== 'message') return false
  const payload = value.payload as MessagePayload
  return (
    typeof payload?.matchId === 'string' &&
    typeof payload?.id === 'string' &&
    typeof payload?.senderId === 'string' &&
    typeof payload?.content === 'string' &&
    typeof payload?.createdAt === 'string'
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
 * Canonical identity-space projection of a message, used to correlate an
 * optimistic placeholder with its server echo. Derives `clientMessageId` from
 * the `optimistic-<clientMessageId>` id prefix when the field is absent
 * (older producers), and the authoritative `id` for persisted rows. Pure.
 */
export function messageEventIdentity(message: MessagePayload): {
  id?: string
  clientMessageId?: string
  optimistic: boolean
} {
  const optimistic = message.id.startsWith(OPTIMISTIC_ID_PREFIX)
  return {
    id: optimistic ? undefined : message.id,
    clientMessageId:
      message.clientMessageId ??
      (optimistic ? message.id.slice(OPTIMISTIC_ID_PREFIX.length) : undefined),
    optimistic,
  }
}

/** Mint the optimistic placeholder id for a client idempotency key. */
export function optimisticMessageId(clientMessageId: string): string {
  return `${OPTIMISTIC_ID_PREFIX}${clientMessageId}`
}

/**
 * True when `a` and `b` are the same logical message — a server echo matching
 * its optimistic placeholder, or the same persisted row. Correlation prefers
 * the client idempotency key when either side can supply it; two different
 * optimistic placeholders are distinct messages even on (senderId, content)
 * collision, so they are never conflated. A persisted row without a stored
 * clientMessageId keeps the documented (senderId, content) short-form match
 * against an unresolved placeholder. Two distinct persisted ids are never
 * equal. Pure.
 */
export function isSameChatMessage(
  a: MessagePayload,
  b: MessagePayload,
): boolean {
  if (a.id === b.id) return true
  const optimisticA = a.id.startsWith(OPTIMISTIC_ID_PREFIX)
  const optimisticB = b.id.startsWith(OPTIMISTIC_ID_PREFIX)
  const keyA =
    a.clientMessageId ??
    (optimisticA ? a.id.slice(OPTIMISTIC_ID_PREFIX.length) : undefined)
  const keyB =
    b.clientMessageId ??
    (optimisticB ? b.id.slice(OPTIMISTIC_ID_PREFIX.length) : undefined)

  if (keyA !== undefined && keyB !== undefined) {
    // The idempotency key pins the correspondence when both sides expose one.
    return keyA === keyB
  }

  if (!optimisticA && !optimisticB) return false
  return a.senderId === b.senderId && a.content === b.content
}

/**
 * Canonical realtime merge: the persisted id is the identity; an optimistic
 * row (`optimistic-<clientMessageId>`) is swapped for the authoritative row
 * when its server echo arrives. Duplicate events for an already-resolved id
 * are ignored (returns the input list unchanged so consumers can skip a
 * re-render). New rows insert in `createdAt ASC, id ASC` sort position; the
 * list is re-sorted on replacement because the authoritative createdAt may
 * differ from the optimistic one. Pure — safe inside a reducer.
 */
export function mergeRealtimeMessage<T extends MessagePayload>(
  current: readonly T[],
  incoming: T,
  toPayload: (message: T) => MessagePayload = (message) => message,
): T[] {
  const incomingPayload = toPayload(incoming)
  const existingIndex = current.findIndex((message) =>
    isSameChatMessage(toPayload(message), incomingPayload),
  )

  if (existingIndex >= 0) {
    const existing = toPayload(current[existingIndex] as T)
    if (existing.id === incomingPayload.id) return current as T[]
    const next = [...current]
    next[existingIndex] = incoming
    // Re-sort on replacement: the authoritative createdAt may differ from the
    // optimistic one (server clock vs client clock).
    return next.sort((a, b) => compareChatMessages(toPayload(a), toPayload(b)))
  }

  return [...current, incoming].sort((a, b) =>
    compareChatMessages(toPayload(a), toPayload(b)),
  )
}

/**
 * Normalize an inbound Ably "message" payload into a MessagePayload.
 * Accepts the typed envelope (S032) and the legacy raw Message shape for
 * back-compat with any existing publisher. Pure: no clock, no I/O, so it is
 * safe inside a reducer (StrictMode double-invocation included) — a malformed
 * legacy row falls back to empty-string sentinels rather than a fresh Date.
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
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : '',
      clientMessageId:
        typeof m.clientMessageId === 'string' ? m.clientMessageId : undefined,
    }
  }
  return null
}
