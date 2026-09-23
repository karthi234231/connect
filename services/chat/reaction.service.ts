// src/services/chat/reaction.service.ts
// P0-12 — server-authoritative reaction toggle + batched read.
// Concurrency (§210): the (message_id, user_id) unique key is the control —
// insert wins, delete removes; no read-then-write race. The table is typed in
// Database (migration 20260916010000 + alignment 20260921000000) so the
// typed client is used directly, with RLS as the real boundary.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  isMessageReaction,
  type MessageReaction,
  type ReactionRecord,
} from '@/lib/chat/reactions'
import { buildReactionEnvelope } from '@/lib/chat/realtime'
import { publishChatEvent } from '@/lib/chat/publish'
import {
  toggleReactionSchema,
  listReactionsSchema,
  type ToggleReactionInput,
  type ListReactionsInput,
} from './reaction.schema'

interface ReactionDbRow {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

function toRecord(row: ReactionDbRow): ReactionRecord | null {
  if (!isMessageReaction(row.emoji)) return null // legacy/unknown → drop
  return {
    messageId: row.message_id,
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  }
}

/** The actor must be a participant of the message's match (RLS parity). Returns the match id. */
async function assertThreadParticipant(
  userId: string,
  messageId: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('messages')
    .select('match_id, matches!inner(user1_id, user2_id)')
    .eq('id', messageId)
    .limit(1)

  if (error) throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)

  const row = data?.[0] as
    | { match_id: string; matches: { user1_id: string; user2_id: string } }
    | undefined

  if (
    !row ||
    (row.matches.user1_id !== userId && row.matches.user2_id !== userId)
  ) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Not a participant of this thread')
  }

  return row.match_id
}

/** Toggle the viewer's single reaction on a message. Returns the new state. */
export async function toggleReaction(
  userId: string,
  input: ToggleReactionInput,
): Promise<{ reacted: boolean }> {
  const parsed = toggleReactionSchema.parse(input)
  const conversationId = await assertThreadParticipant(userId, parsed.messageId)

  const supabase = await createServerSupabaseClient()
  const table = supabase.from('message_reactions')

  // Replace-first: clear any existing reaction, then add if toggling on.
  const removed = await table
    .delete()
    .eq('message_id', parsed.messageId)
    .eq('user_id', userId)
  if (removed.error) {
    throw AppError.fromUnknown(removed.error, ErrorCodes.INTERNAL)
  }

  const { error } = await supabase.from('message_reactions').insert({
    message_id: parsed.messageId,
    user_id: userId,
    emoji: parsed.emoji,
  })

  if (error) {
    // §210 race: a concurrent toggle won the (message_id, user_id) unique key.
    // The row exists — converge on "reacted" instead of surfacing an error
    // (23505 = unique_violation, per the migration's control comment).
    if (error.code !== '23505') {
      logger.error('toggleReaction insert failed', { error, userId })
      throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
    }
  }

  // S032: best-effort fan-out AFTER commit so the peer converges without
  // waiting on a refetch. `active: true` replaces the actor's prior emoji.
  await publishChatEvent(
    conversationId,
    buildReactionEnvelope({
      eventId: crypto.randomUUID(),
      actorId: userId,
      conversationId,
      reaction: {
        messageId: parsed.messageId,
        userId,
        emoji: parsed.emoji,
        active: true,
      },
    }),
  )

  return { reacted: true }
}

/** Remove the viewer's reaction (toggle off). */
export async function removeReaction(
  userId: string,
  input: ToggleReactionInput,
): Promise<{ reacted: boolean }> {
  const parsed = toggleReactionSchema.parse(input)
  const conversationId = await assertThreadParticipant(userId, parsed.messageId)

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', parsed.messageId)
    .eq('user_id', userId)

  if (error) {
    logger.error('removeReaction failed', { error, userId })
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
  }

  // S032: fan out removal so the peer clears the emoji without a refetch.
  await publishChatEvent(
    conversationId,
    buildReactionEnvelope({
      eventId: crypto.randomUUID(),
      actorId: userId,
      conversationId,
      reaction: {
        messageId: parsed.messageId,
        userId,
        emoji: parsed.emoji,
        active: false,
      },
    }),
  )

  return { reacted: false }
}

/** Batched read for one page of messages — one query, never per-message. */
export async function getReactions(
  userId: string,
  input: ListReactionsInput,
): Promise<ReactionRecord[]> {
  const parsed = listReactionsSchema.parse(input)

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji, created_at')
    .in('message_id', parsed.messageIds)

  if (error) {
    logger.error('getReactions failed', { error, userId })
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
  }

  return (data ?? [])
    .map(toRecord)
    .filter((r): r is ReactionRecord => r !== null)
}

export { toggleReactionSchema, listReactionsSchema }
export type { ToggleReactionInput, ListReactionsInput, MessageReaction }
