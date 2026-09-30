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
import { assertThreadAccess, canMessageMatch } from './access'
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
    .select('match_id, matches!inner(user1_id, user2_id, status)')
    .eq('id', messageId)
    .limit(1)

  if (error) throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)

  const row = data?.[0] as
    | {
        match_id: string
        matches: { user1_id: string; user2_id: string; status: string }
      }
    | undefined

  if (
    !row ||
    (row.matches.user1_id !== userId && row.matches.user2_id !== userId)
  ) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Not a participant of this thread')
  }

  // Parity with assertThreadAccess / getAblyToken (#52): a pending match is
  // locked — reacting on it must fail exactly like send/getMessages.
  if (!canMessageMatch({ status: row.matches.status })) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'This thread is not active.')
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
  // The (message_id, user_id) unique key is the §210 control — a concurrent
  // toggle that wins the key between our delete and insert is re-read below,
  // and the fan-out reflects the emoji actually stored, never the loser's input.
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

  // Effective state after the §210 race resolution: on a 23505 the winning row
  // is authoritative, so re-read it; if it vanished between our failed insert
  // and the re-read, converge on "removed".
  let effectiveEmoji = parsed.emoji
  let reacted = true

  if (error) {
    // §210 race: a concurrent toggle won the (message_id, user_id) unique key.
    if (error.code === '23505') {
      const { data: winner, error: rereadError } = await supabase
        .from('message_reactions')
        .select('emoji')
        .eq('message_id', parsed.messageId)
        .eq('user_id', userId)
        .maybeSingle()

      if (rereadError) {
        logger.error('toggleReaction re-read failed', {
          error: rereadError,
          userId,
        })
        throw AppError.fromUnknown(rereadError, ErrorCodes.INTERNAL)
      }

      if (!winner) {
        // The winner removed the reaction between our failed insert and the
        // re-read — storage has no row, so the mirror must converge on removed.
        reacted = false
      } else {
        effectiveEmoji = winner.emoji
      }
    } else {
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
        emoji: effectiveEmoji,
        active: reacted,
      },
    }),
  )

  return { reacted }
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

  // Thread reads are gated exactly like getMessages: the claimed match must
  // exist, the caller must be a participant, and it must be active. The
  // embedded match filter additionally rejects messageIds that do not belong
  // to the claimed match, so a pending match can never be probed through a
  // loose matchId claim.
  await assertThreadAccess(supabase, userId, parsed.matchId)

  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji, created_at, messages!inner(match_id)')
    .in('message_id', parsed.messageIds)
    .eq('messages.match_id', parsed.matchId)

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
