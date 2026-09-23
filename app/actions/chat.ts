// src/app/actions/chat.ts
// Chat boundary actions: every mutation authenticates, validates with a strict
// schema and delegates to the chat/reaction services; reads go through the
// service layer so thread access is asserted server-side.
'use server'

import { randomUUID } from 'crypto'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uuidSchema } from '@/lib/validation'
import {
  createAttachmentUpload,
  getAttachmentUrl,
  getMessages,
  markMessagesAsRead,
  searchMessages,
  sendMessage,
} from '@/services/chat/chat.service'
import {
  getReactions,
  removeReaction,
  toggleReaction,
} from '@/services/chat/reaction.service'
import {
  dismissSuggestion,
  RELATIONSHIP_SUGGESTION_SOURCES,
  type RelationshipSuggestionSource,
} from '@/services/relationships'
import { getMatches } from '@/services/matching/match.service'
import { assertThreadAccessForUser } from '@/services/chat/access'
import { buildTypingEnvelope } from '@/lib/chat/realtime'
import { publishChatEvent } from '@/lib/chat/publish'
import { getAblyToken } from '@/lib/websocket/ably'

const matchInputSchema = z.object({ matchId: uuidSchema }).strict()

const messagesInputSchema = z
  .object({
    matchId: uuidSchema,
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

const messageInputSchema = z
  .object({
    matchId: uuidSchema,
    content: z.string().min(1).max(2000),
    clientMessageId: uuidSchema.optional(),
    attachmentUrl: z.string().trim().min(1).max(500).optional(),
  })
  .strict()

const attachmentPathSchema = z
  .object({ path: z.string().trim().min(1).max(500) })
  .strict()

const attachmentUploadInputSchema = z
  .object({
    matchId: uuidSchema,
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().positive(),
  })
  .strict()

const reactionInputSchema = z
  .object({ messageId: uuidSchema, emoji: z.string().trim().min(1).max(16) })
  .strict()

const reactionsInputSchema = z
  .object({
    matchId: uuidSchema,
    messageIds: z.array(uuidSchema).min(1).max(100),
  })
  .strict()

const searchInputSchema = z
  .object({
    query: z.string().trim().min(2).max(100),
    matchId: uuidSchema.optional(),
  })
  .strict()

/** Suggestion sources the viewer can dismiss (V10-BE-01 vocabulary). */
const dismissalSourceSchema = z.enum(RELATIONSHIP_SUGGESTION_SOURCES)

const typingInputSchema = z
  .object({ matchId: uuidSchema, isTyping: z.boolean() })
  .strict()

export async function getMessagesAction(input: {
  matchId: string
  limit?: number
  cursor?: string
}): Promise<Awaited<ReturnType<typeof getMessages>>> {
  const userId = await requireUser()

  const parsed = messagesInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That conversation is not valid.')
  }

  const { matchId, limit, cursor } = parsed.data

  return getMessages(userId, matchId, cursor, limit ?? 20)
}

export async function getThreadPeerAction(input: { matchId: string }): Promise<{
  fullName: string
  role: string | null
  avatarUrl: string | null
}> {
  const userId = await requireUser()

  const parsed = matchInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That conversation is not valid.')
  }

  const matches = await getMatches(userId)
  const peer = matches.find((m) => m.matchId === parsed.data.matchId)

  if (!peer) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'That conversation was not found.')
  }

  return {
    fullName: peer.otherUser.fullName,
    role: peer.otherUser.role || null,
    avatarUrl: peer.otherUser.avatarUrl ?? null,
  }
}

export async function sendMessageAction(input: {
  matchId: string
  content: string
  clientMessageId?: string
  attachmentUrl?: string
}): Promise<Awaited<ReturnType<typeof sendMessage>>> {
  const userId = await requireUser()

  const parsed = messageInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That message could not be sent.')
  }

  return sendMessage(userId, {
    matchId: parsed.data.matchId,
    content: parsed.data.content,
    // Every gesture carries an idempotency key so an optimistic retry cannot
    // double-write the thread; mint one when the client omitted it.
    clientMessageId: parsed.data.clientMessageId ?? randomUUID(),
    attachmentUrl: parsed.data.attachmentUrl,
  })
}

export async function markMessagesAsReadAction(input: {
  matchId: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = matchInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That conversation is not valid.')
  }

  await markMessagesAsRead(userId, parsed.data.matchId)
}

export async function getAttachmentUrlAction(input: {
  path: string
}): Promise<{ signedUrl: string }> {
  const userId = await requireUser()

  const parsed = attachmentPathSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That attachment is not valid.')
  }

  return getAttachmentUrl(userId, parsed.data.path)
}

export async function createAttachmentUploadAction(input: {
  matchId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<Awaited<ReturnType<typeof createAttachmentUpload>>> {
  const userId = await requireUser()

  const parsed = attachmentUploadInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That attachment is not valid.')
  }

  return createAttachmentUpload(
    userId,
    parsed.data as Parameters<typeof createAttachmentUpload>[1],
  )
}

export async function getMessageReactionsAction(input: {
  matchId: string
  messageIds: string[]
}): Promise<Awaited<ReturnType<typeof getReactions>>> {
  const userId = await requireUser()

  const parsed = reactionsInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Those reactions are not valid.')
  }

  return getReactions(userId, parsed.data)
}

export async function toggleReactionAction(input: {
  messageId: string
  emoji: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = reactionInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That reaction is not valid.')
  }

  await toggleReaction(userId, parsed.data)
}

export async function removeReactionAction(input: {
  messageId: string
  emoji: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = reactionInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That reaction is not valid.')
  }

  await removeReaction(userId, parsed.data)
}

export async function searchMessagesAction(input: {
  query: string
  matchId?: string
}): Promise<Awaited<ReturnType<typeof searchMessages>>> {
  const userId = await requireUser()

  const parsed = searchInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That search is not valid.')
  }

  return searchMessages(userId, parsed.data)
}

/**
 * V10-BE-01 — sources the viewer already dismissed for this conversation.
 * RLS scopes the read to the caller's own dismissal rows.
 */
export async function getDismissedSuggestionSourcesAction(
  matchId: string,
): Promise<string[]> {
  const userId = await requireUser()

  const parsed = uuidSchema.safeParse(matchId)

  if (!parsed.success) {
    return []
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('relationship_suggestion_dismissals')
    .select('source')
    .eq('user_id', userId)
    .eq('match_id', parsed.data)

  if (error) {
    logger.warn('getDismissedSuggestionSourcesAction: read failed', {
      matchId: parsed.data,
      error: error.message,
    })
    return []
  }

  return (data ?? [])
    .map((row) => row.source)
    .filter((source): source is string => typeof source === 'string')
}

export async function dismissRelationshipSuggestionAction(
  matchId: string,
  source: RelationshipSuggestionSource,
): Promise<void> {
  const userId = await requireUser()

  const idParsed = uuidSchema.safeParse(matchId)
  const sourceParsed = dismissalSourceSchema.safeParse(source)

  if (!idParsed.success || !sourceParsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That suggestion could not be dismissed.',
    )
  }

  await dismissSuggestion(userId, idParsed.data, sourceParsed.data)
}

export async function getAblyTokenAction(input: {
  matchId: string
}): Promise<{ token: string; clientId: string }> {
  const userId = await requireUser()

  const parsed = matchInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That conversation is not valid.')
  }

  return getAblyToken(parsed.data.matchId, userId)
}

/**
 * S032 typing presence — ephemeral, never persisted. The caller is asserted
 * as a thread participant first so presence cannot leak across matches;
 * the envelope is fan-out only (no storage, no receipt).
 */
export async function publishTypingAction(input: {
  matchId: string
  isTyping: boolean
}): Promise<void> {
  const userId = await requireUser()

  const parsed = typingInputSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That status is not valid.')
  }

  await assertThreadAccessForUser(userId, parsed.data.matchId)

  await publishChatEvent(
    parsed.data.matchId,
    buildTypingEnvelope({
      eventId: randomUUID(),
      actorId: userId,
      conversationId: parsed.data.matchId,
      isTyping: parsed.data.isTyping,
    }),
  )
}
