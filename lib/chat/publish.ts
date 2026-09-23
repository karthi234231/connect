// src/lib/chat/publish.ts
// S032 — server-side fan-out of chat realtime events. The database is the
// source of truth; realtime is a delivery accelerator, so a failed publish
// must never fail the write that triggered it. Every caller uses
// publishChatEvent, which swallows publish errors and logs them (same
// best-effort contract as the S033 receipt fan-out in markMessagesAsRead).
import { logger } from '@/lib/logger'
import { getAblyServerClient } from '@/lib/websocket/ably'
import type { ChatEventEnvelope } from './realtime'

export async function publishChatEvent(
  matchId: string,
  envelope: ChatEventEnvelope,
): Promise<void> {
  try {
    const rest = getAblyServerClient()
    await rest.channels.get(`match:${matchId}`).publish(envelope.type, envelope)
  } catch (error) {
    logger.warn('Failed to publish chat realtime event', {
      matchId,
      eventType: envelope.type,
      error,
    })
  }
}
