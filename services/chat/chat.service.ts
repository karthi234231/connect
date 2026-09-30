import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import { sendMessageSchema, type SendMessageInput } from './message.schema'
import { assertThreadAccess, otherParticipantId } from './access'
import { areBlocked } from '@/services/safety'
import { rowToMessage, type Message } from './mappers'
import { getAblyServerClient } from '@/lib/websocket/ably'
import { buildMessageEnvelope, buildReceiptEnvelope } from '@/lib/chat/realtime'
import { publishChatEvent } from '@/lib/chat/publish'
import {
  MATCH_ATTACHMENTS_BUCKET,
  buildAttachmentPath,
  isValidAttachmentPath,
  validateAttachmentFile,
} from '@/lib/chat/attachment'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { isMatchReason, matchReasonLabel } from '@/services/matching/reasons'
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'

export { rowToMessage, type Message } from './mappers'

interface MessageDatabaseRow {
  id: string
  match_id: string
  sender_id: string
  content: string
  attachment_url: string | null
  read_at: string | null
  created_at: string
  client_message_id: string | null
}

function normalizeLimit(value: number, fallback = 50): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(Math.trunc(value), 1), 50)
}

/**
 * Non-empty caption persisted for an attachment-only send (empty content +
 * attachmentUrl present). The composer allows this gesture
 * (`canSubmitDraft`), and `messages.content` is NOT NULL with a 1..2000
 * length check — the DB cannot store an empty body.
 */
export const ATTACHMENT_ONLY_CAPTION = 'Attachment'

export async function sendMessage(
  senderId: string,
  input: SendMessageInput,
): Promise<Message> {
  const supabase = await createServerSupabaseClient()

  const validated = sendMessageSchema.parse(input)

  const { matchId, clientMessageId, attachmentUrl } = validated

  // Attachment-only sends must still persist a non-empty caption (DB parity:
  // messages.content is NOT NULL with a 1..2000 length check). The composer
  // lets a send through when only an attachment is queued, so the service
  // closes the loop here rather than at the schema.
  let content = validated.content
  if (content.length === 0) {
    if (!attachmentUrl) {
      throw new AppError(ErrorCodes.VALIDATION, 'Message cannot be empty.')
    }
    content = ATTACHMENT_ONLY_CAPTION
  }

  // 1) Pure shape check — no I/O, no data observable. The path's match segment
  //    must equal the message's matchId (a path minted for another match is
  //    rejected here before any storage/DB step).
  if (attachmentUrl && !isValidAttachmentPath(attachmentUrl, matchId)) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'Attachment does not belong to this conversation',
    )
  }

  // 2) AUTHORIZATION GATE — must run before any observable/expensive step
  //    (storage probe, idempotency lookup) so a non-participant or an
  //    inactive relationship can never learn anything about object existence
  //    or message state. Returns the match row so the safety gate below can
  //    resolve the peer without another DB query.
  const match = await assertThreadAccess(supabase, senderId, matchId)

  // 3) SAFETY GATE — fail closed. `areBlocked` throws on infrastructure
  //    failure, so a block-check outage never opens the channel.
  await assertCanMessagePair(senderId, otherParticipantId(match, senderId))

  // 4) Idempotency: repeated client_message_id converges to the SAME logical
  //    message. Only rows claimed by the same sender for the same match may be
  //    returned; a key owned by another sender/match is FORBIDDEN. Runs before
  //    the storage probe so a duplicate retry converges even if the uploaded
  //    object was cleaned up since, and never double-fans-out.
  const existingQuery = await supabase
    .from('messages')
    .select(
      'id, match_id, sender_id, content, attachment_url, read_at, created_at, client_message_id',
    )
    .eq('client_message_id', clientMessageId)
    .maybeSingle()

  if (existingQuery.error && existingQuery.error.code !== 'PGRST116') {
    logger.error('Failed to check message idempotency key', {
      matchId,
      senderId,
      clientMessageId,
      error: existingQuery.error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to send message', {
      cause: existingQuery.error,
    })
  }

  if (existingQuery.data) {
    const existing = existingQuery.data as unknown as MessageDatabaseRow

    if (existing.sender_id !== senderId || existing.match_id !== matchId) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Invalid message idempotency key',
      )
    }

    return rowToMessage(existing)
  }

  // 5) Attachment must already exist in storage (upload completes before
  //    send). Runs after authorization + idempotency: the probe is scoped to a
  //    match the sender provably participates in, only fires on fresh sends,
  //    and rejects forged object paths that pass the pattern check but were
  //    never uploaded.
  if (attachmentUrl) {
    const objectPath = attachmentUrl.split('/').slice(1).join('/')
    const { data: objectHead, error: objectError } =
      await getAdminSupabaseClient()
        .storage.from(MATCH_ATTACHMENTS_BUCKET)
        .list(objectPath.split('/').slice(0, -1).join('/'), {
          search: objectPath.split('/').pop() ?? '',
          limit: 1,
        })

    if (objectError || !objectHead || objectHead.length === 0) {
      logger.warn('Attachment upload not found at send time', {
        matchId,
        attachmentUrl,
        error: objectError?.message,
      })
      throw new AppError(
        ErrorCodes.VALIDATION,
        'Attachment upload not found. Upload the file before sending.',
      )
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: senderId,
      content,
      client_message_id: clientMessageId,
      attachment_url: attachmentUrl,
    })
    .select(
      'id, match_id, sender_id, content, attachment_url, read_at, created_at, client_message_id',
    )
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raced, error: racedError } = await supabase
        .from('messages')
        .select(
          'id, match_id, sender_id, content, attachment_url, read_at, created_at, client_message_id',
        )
        .eq('client_message_id', clientMessageId)
        .maybeSingle()

      if (racedError) {
        throw new AppError(
          ErrorCodes.INTERNAL,
          'Failed to resolve duplicate message',
          {
            cause: racedError,
          },
        )
      }

      if (raced) {
        const existing = raced as unknown as MessageDatabaseRow

        if (existing.sender_id !== senderId || existing.match_id !== matchId) {
          throw new AppError(
            ErrorCodes.FORBIDDEN,
            'Invalid message idempotency key',
          )
        }

        return rowToMessage(existing)
      }
    }

    logger.error('Failed to insert message', {
      matchId,
      senderId,
      error: insertError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to send message', {
      cause: insertError,
    })
  }

  if (!inserted) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to send message')
  }

  const message = inserted as unknown as MessageDatabaseRow

  const { count: messageCount } = await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('match_id', matchId)

  if (messageCount === 1) {
    const { error: timelineError } = await supabase
      .from('match_timeline')
      .insert({
        match_id: matchId,
        event_type: 'first_reply',
        meta: {
          sender_id: senderId,
        },
      })

    if (timelineError) {
      logger.warn('Failed to create first reply timeline event', {
        matchId,
        messageId: message.id,
        error: timelineError.message,
      })
    }
  }

  await trackFunnel({
    eventName: FunnelEvents.MessageSent,
    actorId: senderId,
    entityType: 'match',
    entityId: matchId,
    result: 'sent',
    surface: 'chat',
  })

  logger.info('Message sent', {
    matchId,
    messageId: message.id,
    senderId,
  })

  // S032: realtime delivery accelerator — fan out AFTER commit (the DB stays
  // the source of truth; clients reconcile via refetch if this fails). The
  // payload stays MessagePayload-shaped and carries clientMessageId + senderId
  // so a later subscriber can swap its `optimistic-<clientMessageId>` row for
  // this authoritative one (mergeRealtimeMessage keys on senderId/content;
  // clientMessageId resolves ambiguous identical sends).
  const envelopeMessage = {
    matchId,
    id: message.id,
    senderId,
    content: message.content,
    createdAt: message.created_at,
    clientMessageId,
  }

  await publishChatEvent(
    matchId,
    buildMessageEnvelope({
      eventId: crypto.randomUUID(),
      actorId: senderId,
      conversationId: matchId,
      message: envelopeMessage,
    }),
  )

  return rowToMessage(message)
}

/**
 * Safety gate for the chat composer: no messaging across an active block, in
 * either direction. Fail closed — `areBlocked` throws on any infrastructure
 * failure (cache and DB), so an outage never opens the channel.
 */
export async function assertCanMessagePair(
  userIdA: string,
  userIdB: string,
): Promise<void> {
  if (await areBlocked(userIdA, userIdB)) {
    throw new AppError(
      ErrorCodes.BLOCKED,
      'Messaging is not available for this conversation.',
    )
  }
}

export interface ConversationSummary {
  matchId: string
  otherUserId: string
  status: string
  createdAt: string
  matchReason?: string | null
  lastMessage: {
    content: string
    createdAt: string
    senderId: string
  } | null
  unreadCount: number
}

// Keyset cursor for the inbox stream: (lastMessageAt desc, matchId desc).
export interface InboxCursor {
  lastMessageAt: string
  matchId: string
}

export interface InboxPage {
  conversations: ConversationSummary[]
  nextCursor: InboxCursor | null
}

const inboxCursorSchema = z
  .object({
    lastMessageAt: z.string().datetime(),
    matchId: z.string().uuid(),
  })
  .strict()

// Keyset cursor for the message page: (created_at, id) tuple, base64-encoded.
// Validated here so a crafted cursor never reaches PostgREST as an invalid
// timestamp/uuid filter (which would surface as a 500 instead of a clean
// VALIDATION 400).
const messageCursorSchema = z
  .object({
    c: z.string().datetime(),
    id: uuidSchema,
  })
  .strict()

const INBOX_DEFAULT_LIMIT = 30
const INBOX_MAX_LIMIT = 50

/**
 * S24: keyset-paginated chat inbox. Message-bearing conversations stream from
 * the chat_threads projection ordered by (last_message_at desc, match_id desc)
 * — bounded by limit+1 with a server-side cursor filter. Conversations with no
 * messages yet come from a bounded anti-join (no thread row) and carry no
 * cursor; they surface as "requests"/new matches at the top of a page.
 */
export async function getInbox(
  userId: string,
  opts: { limit?: number; cursor?: InboxCursor | null } = {},
): Promise<InboxPage> {
  const supabase = await createServerSupabaseClient()

  const limit = Math.min(
    Math.max(opts.limit ?? INBOX_DEFAULT_LIMIT, 1),
    INBOX_MAX_LIMIT,
  )

  let cursor: InboxCursor | null = null
  if (opts.cursor) {
    const parsed = inboxCursorSchema.safeParse(opts.cursor)
    if (!parsed.success) {
      throw new AppError(ErrorCodes.VALIDATION, 'Invalid inbox cursor')
    }
    cursor = parsed.data
  }

  // PostgREST scoping (S24 regression guard): on `chat_threads` the columns
  // belong to the EMBEDDED `matches` relation, so the filter is the plain
  // column list plus `{ referencedTable: 'matches' }` — a table-qualified
  // `matches.user1_id.eq.<id>` inside a top-level `.or()` is rejected with
  // PGRST100 (see tests/units/chat-inbox-filter.test.ts).
  const participantFilter = `user1_id.eq.${userId},user2_id.eq.${userId}`

  let threadsQuery = supabase
    .from('chat_threads')
    .select(
      'match_id, last_message_content, last_message_at, last_message_sender_id, unread_user1, unread_user2, matches!inner(id, user1_id, user2_id, status, created_at)',
    )
    .or(participantFilter, { referencedTable: 'matches' })
    .in('matches.status', ['active', 'pending'])
    .order('last_message_at', { ascending: false })
    .order('match_id', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    // Keyset: strictly older than the cursor, with match_id as tie-breaker.
    threadsQuery = threadsQuery.or(
      `last_message_at.lt.${cursor.lastMessageAt},and(last_message_at.eq.${cursor.lastMessageAt},match_id.lt.${cursor.matchId})`,
    )
  }

  const { data: threadRows, error: threadsError } = await threadsQuery

  if (threadsError) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load conversations', {
      cause: threadsError,
    })
  }

  type ThreadedRow = {
    match_id: string
    last_message_content: string | null
    last_message_at: string
    last_message_sender_id: string
    unread_user1: number
    unread_user2: number
    matches: {
      id: string
      user1_id: string
      user2_id: string
      status: string
      created_at: string
    }
  }

  const threaded = (threadRows ?? []) as unknown as ThreadedRow[]
  const hasMore = threaded.length > limit
  const pageRows = hasMore ? threaded.slice(0, limit) : threaded

  const conversations: ConversationSummary[] = pageRows.map((row) => {
    const match = row.matches
    return {
      matchId: match.id,
      otherUserId: match.user1_id === userId ? match.user2_id : match.user1_id,
      status: match.status,
      createdAt: match.created_at,
      lastMessage: {
        content: row.last_message_content ?? '',
        createdAt: row.last_message_at,
        senderId: row.last_message_sender_id,
      },
      unreadCount:
        match.user1_id === userId ? row.unread_user1 : row.unread_user2,
    }
  })

  // Conversations with no messages yet: matches with no chat_threads row
  // (anti-join on the embedded projection). Bounded; ordered by recency.
  const { data: emptyMatches, error: emptyError } = await supabase
    .from('matches')
    .select(
      'id, user1_id, user2_id, status, created_at, chat_threads!left(match_id)',
    )
    .or(participantFilter)
    .in('status', ['active', 'pending'])
    .is('chat_threads.match_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (emptyError) {
    logger.warn('Failed to load empty conversations', {
      userId,
      error: emptyError.message,
    })
  }

  type EmptyMatchRow = {
    id: string
    user1_id: string
    user2_id: string
    status: string
    created_at: string
  }

  for (const match of (emptyMatches ?? []) as unknown as EmptyMatchRow[]) {
    conversations.push({
      matchId: match.id,
      otherUserId: match.user1_id === userId ? match.user2_id : match.user1_id,
      status: match.status,
      createdAt: match.created_at,
      lastMessage: null,
      unreadCount: 0,
    })
  }

  // S25A — batch the stored recommendation reason per conversation
  // (same source of truth as the matches page; degrades to null).
  const otherUserIds = [...new Set(conversations.map((c) => c.otherUserId))]

  if (otherUserIds.length > 0) {
    const { data: recRows, error: recError } = await supabase
      .from('recommendations')
      .select('candidate_id, reasons')
      .eq('user_id', userId)
      .in('candidate_id', otherUserIds)

    if (recError) {
      logger.warn('Failed to load conversation reasons', {
        userId,
        error: recError.message,
      })
    }

    const reasonsByCandidate = new Map<string, string>()
    for (const row of (recRows ?? []) as unknown as Array<{
      candidate_id: string
      reasons: unknown
    }>) {
      if (reasonsByCandidate.has(row.candidate_id)) continue
      const first = Array.isArray(row.reasons) ? row.reasons[0] : undefined
      if (typeof first === 'string') {
        reasonsByCandidate.set(row.candidate_id, first)
      } else if (isMatchReason(first)) {
        reasonsByCandidate.set(row.candidate_id, matchReasonLabel(first))
      }
    }

    for (const conversation of conversations) {
      conversation.matchReason =
        reasonsByCandidate.get(conversation.otherUserId) ?? null
    }
  }

  const last = pageRows[pageRows.length - 1]
  const nextCursor: InboxCursor | null =
    hasMore && last
      ? { lastMessageAt: last.last_message_at, matchId: last.matches.id }
      : null

  return { conversations, nextCursor }
}

export async function getMessages(
  userId: string,
  matchId: string,
  cursor?: string,
  limit = 50,
): Promise<{
  messages: Message[]
  hasMore: boolean
  nextCursor?: string
}> {
  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, matchId)

  const safeLimit = normalizeLimit(limit)

  let query = supabase
    .from('messages')
    .select(
      'id, match_id, sender_id, content, attachment_url, read_at, created_at, client_message_id',
    )
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(safeLimit + 1)

  if (cursor) {
    // #53: keyset cursor = (created_at, id) tuple, base64-encoded. Timestamp
    // alone can split ties and skip/duplicate messages within the same second.
    let decoded: unknown
    try {
      decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
    } catch {
      throw new AppError(ErrorCodes.VALIDATION, 'Malformed cursor')
    }
    const parsedCursor = messageCursorSchema.safeParse(decoded)
    if (!parsedCursor.success) {
      throw new AppError(ErrorCodes.VALIDATION, 'Malformed cursor')
    }
    // Escape quotes for the PostgREST .or() value syntax.
    const c = parsedCursor.data.c.replace(/'/g, "''")
    const id = parsedCursor.data.id.replace(/'/g, "''")
    query = query.or(`and(created_at.eq.${c},id.lt.${id}),created_at.lt.${c}`)
  }

  const { data, error } = await query

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch messages', {
      cause: error,
    })
  }

  const typedData = (data ?? []) as unknown as MessageDatabaseRow[]

  const hasMore = typedData.length > safeLimit

  const page = typedData.slice(0, safeLimit)

  const mapped = page.map(rowToMessage)

  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({ c: last.created_at, id: last.id }),
        ).toString('base64')
      : undefined

  return {
    messages: mapped.reverse(),
    hasMore,
    nextCursor,
  }
}

export async function markMessagesAsRead(
  userId: string,
  matchId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, matchId)

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('messages')
    .update({
      read_at: now,
    })
    .eq('match_id', matchId)
    .neq('sender_id', userId)
    .is('read_at', null)

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to mark messages as read', {
      cause: error,
    })
  }

  // S033: best-effort realtime receipt fan-out AFTER commit. The DB stays the
  // source of truth — clients reconcile via refetch if this publish fails.
  try {
    const rest = getAblyServerClient()
    await rest.channels.get(`match:${matchId}`).publish(
      'receipt',
      buildReceiptEnvelope({
        eventId: crypto.randomUUID(),
        actorId: userId,
        conversationId: matchId,
        payload: { matchId, readerId: userId, readAt: now },
      }),
    )
  } catch (publishError) {
    logger.warn('Failed to publish receipt event', {
      matchId,
      error: publishError,
    })
  }
}

export async function getUnreadCount(
  userId: string,
  matchId: string,
): Promise<number> {
  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, matchId)

  const { count, error } = await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('match_id', matchId)
    .neq('sender_id', userId)
    .is('read_at', null)

  if (error) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to get unread count', {
      cause: error,
    })
  }

  return count ?? 0
}

// ─── S034: Attachments ──────────────────────────────────────

const attachmentUploadSchema = z.object({
  matchId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
})

const SIGNED_URL_TTL_SECONDS = 300

/** Signed attachment URL expiry (s). Exported for contract verification. */
export { SIGNED_URL_TTL_SECONDS }

export async function createAttachmentUpload(
  userId: string,
  input: z.infer<typeof attachmentUploadSchema>,
): Promise<{
  path: string
  signedUrl: string
  token: string
  ownership: {
    matchId: string
    uploaderId: string
    bucket: string
    createdAt: string
  }
}> {
  const validated = attachmentUploadSchema.parse(input)

  const fileCheck = validateAttachmentFile({
    type: validated.mimeType,
    size: validated.sizeBytes,
  })

  if (!fileCheck.ok) {
    throw new AppError(ErrorCodes.VALIDATION, fileCheck.reason)
  }

  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, validated.matchId)

  // Server-trusted path: matchId comes from the validated input, never
  // concatenated client-side beyond the authorized thread.
  const path = buildAttachmentPath(validated.matchId, validated.fileName)

  // S29 — explicit ownership metadata for the grant. Match segment binds the grant to this match; uploaderId binds it to this session identity. Both are re-checked at send time (path match-segment + thread membership), so a grant can never be replayed into another conversation. GDPR-compatible: bucket-relative path keeps the erasure worker's {matchId}/* enumeration working.
  const ownership = {
    matchId: validated.matchId,
    uploaderId: userId,
    bucket: MATCH_ATTACHMENTS_BUCKET,
    createdAt: new Date().toISOString(),
  } as const

  const { data, error } = await getAdminSupabaseClient()
    .storage.from(MATCH_ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    logger.error('Failed to create attachment upload URL', {
      matchId: validated.matchId,
      error: error?.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to prepare attachment upload',
      { cause: error },
    )
  }

  logger.info('Attachment upload prepared', {
    matchId: validated.matchId,
    userId,
    path,
  })

  return {
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
    ownership,
  }
}

export async function getAttachmentUrl(
  userId: string,
  path: string,
): Promise<{ signedUrl: string }> {
  const segments = path.split('/')

  if (segments.length < 3 || segments[0] !== MATCH_ATTACHMENTS_BUCKET) {
    throw new AppError(ErrorCodes.VALIDATION, 'Invalid attachment path')
  }

  const matchId = segments[1]!

  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, matchId)

  const { data, error } = await getAdminSupabaseClient()
    .storage.from(MATCH_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error || !data) {
    logger.error('Failed to sign attachment URL', {
      path,
      error: error?.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load attachment', {
      cause: error,
    })
  }

  return { signedUrl: data.signedUrl }
}

// ─── S035: Message search ───────────────────────────────────

const messageSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
  matchId: z.string().uuid().optional(),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(20).optional(),
})

export interface MessageSearchResult {
  id: string
  matchId: string
  senderId: string
  content: string
  createdAt: string
}

export async function searchMessages(
  userId: string,
  input: z.infer<typeof messageSearchSchema>,
): Promise<MessageSearchResult[]> {
  const validated = messageSearchSchema.parse(input)

  const supabase = await createServerSupabaseClient()

  // S23 — the RPC is participant-scoped per row, but a scoped search must
  // ALSO prove the caller belongs to THAT thread: otherwise a participant of
  // thread A can probe thread B's existence/content via scoped queries
  // (the RPC would simply return [] for non-members, leaking membership
  // through response differences). Fail closed before the RPC.
  if (validated.matchId) {
    await assertThreadAccess(supabase, userId, validated.matchId)
  }

  const { data, error } = await supabase.rpc('search_messages', {
    p_query: validated.query,
    ...(validated.matchId ? { p_match_id: validated.matchId } : {}),
    ...(validated.before ? { p_before: validated.before } : {}),
    ...(validated.limit ? { p_limit: validated.limit } : {}),
  })

  if (error) {
    logger.error('Message search failed', { userId, error: error.message })
    throw new AppError(ErrorCodes.INTERNAL, 'Message search failed', {
      cause: error,
    })
  }

  // Defense-in-depth: the RPC already filters to participant matches, but the
  // service layer re-asserts thread access per result's matchId is implicit —
  // only map rows, never widen. (Scoped searches were gated above; unscoped
  // results are participant-filtered row-by-row by the RPC itself.)
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      matchId: String(record.match_id),
      senderId: String(record.sender_id),
      content: String(record.content),
      createdAt: String(record.created_at),
    }
  })
}
