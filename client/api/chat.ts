/**
 * Chat client API — the single client-side boundary for every chat read and
 * mutation. Pure adapter over the server actions: every export validates
 * nothing itself, maps the server result onto a client-safe shape, and lets
 * `AppError`s propagate so callers surface them verbatim.
 *
 * PATH-vs-SIGNED-URL CONTRACT (the convention the chat UI wave relies on):
 *
 * - `path` (also surfaced through the legacy field name `attachment_url`:
 *   `MessageSummary.attachment_url`, `MessageDraft.attachmentUrl`) is a
 *   canonical STORAGE PATH inside the private `match-attachments` bucket,
 *   shaped `match-attachments/{matchId}/{uuid}.{ext}`. It is a KEY, never a
 *   URL — rendering it directly (e.g. `<img src={path}>`) always 404s.
 * - `fetchAttachmentUrl(path)` resolves a path into a short-lived signed URL
 *   that MAY be rendered directly (`<img src>` / `<a href>`).
 * - `createChatAttachmentUpload(matchId, file)` mints `{ path, signedUrl }`
 *   where `signedUrl` is an UPLOAD-only endpoint. POST the bytes to it via
 *   `uploadChatAttachment`, then send the message with the `path`. A grant
 *   URL is never a display URL — even the composer preview must resolve
 *   through `fetchAttachmentUrl`.
 */
import type {
  MessageDraft,
  MessageSummary,
  ChatThreadSummary,
} from '@/types/message'
import { MATCH_ATTACHMENTS_BUCKET } from '@/lib/chat/attachment'
import {
  createAttachmentUploadAction,
  getAttachmentUrlAction,
  getMessageReactionsAction,
  getMessagesAction,
  markMessagesAsReadAction,
  removeReactionAction,
  sendMessageAction,
  toggleReactionAction,
} from '@/app/actions/chat'
import { getInboxAction } from '@/app/actions/inbox'
import type { ReactionRecord } from '@/lib/chat/reactions'

/**
 * Chat server actions follow the repo `{ ok: false, error }` failure shape:
 * success stays the bare payload, failure is `{ ok: false, error: string }`
 * instead of a thrown `AppError`. `unwrap` restores the throwing boundary the
 * chat UI try/catches rely on, so converting actions in `@/app/actions/*` never
 * leaks a result-shape change into consumers. A success payload has no `ok`
 * key and passes through untouched.
 */
type OkResult<T> = T | { ok: false; error: string }

async function unwrap<T>(p: Promise<OkResult<T>>): Promise<T> {
  const r = await p
  if (r && typeof r === 'object' && 'ok' in r && r.ok === false) {
    throw new Error(r.error)
  }
  return r as T
}

export interface FetchMessagesOptions {
  matchId: string
  limit?: number
  cursor?: string
}

/**
 * Fetch one page of a thread's message stream, mapped oldest→newest onto
 * `MessageSummary` (snake_case, `MessageRow`-shaped). The server page
 * `{ messages, nextCursor }` mapping is preserved — `nextCursor` (base64
 * keyset cursor) is simply not exposed yet, so this shape stays stable for
 * the upcoming pagination wave (`use-chat-messages.ts`).
 */
export async function watchMessages(
  options: FetchMessagesOptions,
): Promise<MessageSummary[]> {
  const page = await unwrap(
    getMessagesAction({
      matchId: options.matchId,
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    }),
  )
  return page.messages.map((m) => ({
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    sender_id: m.senderId,
    read_at: m.readAt ?? null,
    attachment_url: m.attachmentUrl ?? null,
  }))
}

/**
 * Persist one outgoing message. When `draft.attachmentUrl` is set it MUST be
 * the canonical storage PATH returned by `createChatAttachmentUpload`
 * (`match-attachments/{matchId}/{uuid}.{ext}`) — never a URL; the server
 * rejects anything else at the boundary.
 *
 * Idempotency: pass the same `clientMessageId` (uuid) when retrying a failed
 * optimistic send. The server converges repeated sends of one key onto the
 * same logical message, so a retry can never double-write the thread; omit it
 * to let the server mint a key.
 */
export async function sendChatMessage(draft: MessageDraft): Promise<void> {
  await unwrap(
    sendMessageAction({
      matchId: draft.matchId,
      content: draft.content,
      ...(draft.clientMessageId
        ? { clientMessageId: draft.clientMessageId }
        : {}),
      ...(draft.attachmentUrl ? { attachmentUrl: draft.attachmentUrl } : {}),
    }),
  )
}

/** Mark every inbound message in the thread as read (single server call). */
export async function markConversationRead(matchId: string): Promise<void> {
  await unwrap(markMessagesAsReadAction({ matchId }))
}

/**
 * Server inbox cursor — the service's `(lastMessageAt desc, matchId desc)`
 * keyset tuple. Serialized onto the opaque client `string` surface by
 * `encodeInboxCursor`, parsed back for the action call by `decodeInboxCursor`.
 */
interface InboxCursorPayload {
  lastMessageAt: string
  matchId: string
}

function encodeInboxCursor(
  cursor: InboxCursorPayload | null,
): string | null {
  return cursor ? JSON.stringify(cursor) : null
}

function decodeInboxCursor(
  cursor: string | undefined,
): InboxCursorPayload | undefined {
  if (!cursor) return undefined
  try {
    const parsed: unknown = JSON.parse(cursor)
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      typeof (parsed as InboxCursorPayload).lastMessageAt === 'string' &&
      typeof (parsed as InboxCursorPayload).matchId === 'string'
    ) {
      return parsed as InboxCursorPayload
    }
  } catch {
    // Malformed cursor — treat as "no cursor" (page 1) rather than crash.
  }
  return undefined
}

export interface ThreadsPage {
  conversations: ChatThreadSummary[]
  hasMore: boolean
  nextCursor: string | null
}

export interface FetchThreadsPageOptions {
  limit?: number
  cursor?: string
}

/** Inputs the inbox action currently accepts; extended with the cursor once
 * the server-action refactor exposes it (`getInboxAction` is keyset-aware in
 * `services/chat/chat.service.ts`). */
type InboxActionArgs = Parameters<
  typeof getInboxAction
>[0] extends infer T | undefined
  ? T & { cursor?: InboxCursorPayload }
  : never

function toChatThreadSummary(conversation: {
  matchId: string
  lastMessage?: { content: string; createdAt: string; senderId: string } | null
  unreadCount: number
}): ChatThreadSummary {
  return {
    matchId: conversation.matchId,
    lastMessageAt: conversation.lastMessage?.createdAt ?? null,
    lastMessageContent: conversation.lastMessage?.content ?? null,
    lastMessageSenderId: conversation.lastMessage?.senderId ?? null,
    unread: conversation.unreadCount,
  }
}

/**
 * Fetch one page of the inbox stream, mapped onto `ChatThreadSummary` exactly
 * like `fetchThreads`. The backend page `{ conversations, nextCursor }` maps
 * onto `hasMore` (`nextCursor != null` — the server only mints a cursor when
 * a further page exists) and an opaque serialized `nextCursor` string for the
 * next `fetchThreadsPage({ cursor })` call.
 */
export async function fetchThreadsPage(
  options?: FetchThreadsPageOptions,
): Promise<ThreadsPage> {
  const cursor = decodeInboxCursor(options?.cursor)
  const args: InboxActionArgs = {
    ...(options?.limit != null ? { limit: options.limit } : {}),
    ...(cursor ? { cursor } : {}),
  }
  const inbox = await unwrap(getInboxAction(args))
  return {
    conversations: inbox.conversations.map(toChatThreadSummary),
    hasMore: inbox.nextCursor !== null,
    nextCursor: encodeInboxCursor(inbox.nextCursor),
  }
}

/**
 * Fetch the thread list (page 1), mapped onto `ChatThreadSummary`. Back-compat
 * shim over `fetchThreadsPage` — page metadata is dropped, so existing callers
 * (`app/dashboard/page.tsx`, `use-chat-inbox.ts`) keep working unchanged.
 */
export async function fetchThreads(
  limit?: number,
): Promise<ChatThreadSummary[]> {
  return (await fetchThreadsPage(limit != null ? { limit } : {})).conversations
}

/** Load reactions for up to 100 message ids in one thread. */
export async function getChatReactions(
  matchId: string,
  messageIds: string[],
): Promise<ReactionRecord[]> {
  return unwrap(getMessageReactionsAction({ matchId, messageIds }))
}

/** Add `emoji` to `messageId`. Server blocks emoji outside the shared allowlist. */
export async function toggleChatReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  await unwrap(toggleReactionAction({ messageId, emoji }))
}

/** Remove `emoji` from `messageId` (no-op if the viewer never reacted). */
export async function removeChatReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  await unwrap(removeReactionAction({ messageId, emoji }))
}

/**
 * Resolve a canonical attachment STORAGE PATH into a short-lived signed URL
 * that can be rendered directly (see the module-level contract).
 *
 * - `path` must be a canonical `match-attachments/{matchId}/{uuid}.{ext}`
 *   path as stored in `MessageSummary.attachment_url` / the grant. Anything
 *   else fails fast here, matching the server's own bucket-prefix rule.
 * - Returns a READ URL minted for the current user — thread access is
 *   asserted server-side from the path's match segment. It expires after
 *   `SIGNED_URL_TTL_SECONDS` (300s / ~5 min, `services/chat/chat.service.ts`).
 * - Expiry is NOT baked in client-side: each call signs afresh, so a UI wave
 *   rendering attachments should BATCH calls per `matchId` (each is a server
 *   round-trip behind the actions boundary) and CACHE results with a min-TTL
 *   of at most a couple of minutes — never serve a cached URL past its 5-min
 *   window, and never call this per message per render.
 */
export async function fetchAttachmentUrl(path: string): Promise<string> {
  if (!path.startsWith(`${MATCH_ATTACHMENTS_BUCKET}/`)) {
    throw new Error(
      `Invalid attachment path: expected a '${MATCH_ATTACHMENTS_BUCKET}/…' storage path, got '${path}'.`,
    )
  }
  const { signedUrl } = await unwrap(getAttachmentUrlAction({ path }))
  return signedUrl
}

export interface ChatAttachmentUpload {
  /**
   * Canonical storage path of the uploaded object — the value to send on the
   * message (`MessageDraft.attachmentUrl`) and to resolve for display via
   * `fetchAttachmentUrl`. Never a URL.
   */
  path: string
  /**
   * UPLOAD-ONLY signed URL for `uploadChatAttachment`. The server's
   * `createSignedUploadUrl` grant already embeds `token` in its query string,
   * so this URL is the whole upload contract; it is NOT a display URL.
   */
  signedUrl: string
  /** Storage token, embedded in `signedUrl`; returned only for API parity. */
  token: string
}

/**
 * Mint a match-scoped attachment upload grant. The server assigns the
 * canonical `match-attachments/{matchId}/{uuid}.{ext}` path and returns it
 * with an upload-only signed URL.
 *
 * Flow: (1) call this grant; (2) POST the raw bytes to `signedUrl` via
 * `uploadChatAttachment` (single-shot POST — no PUT, no separate finalize
 * step: the token rides in the signed URL's query string); (3) send the
 * message passing the `path` as `attachmentUrl` — the send service re-verifies
 * the object exists in storage before committing.
 */
export async function createChatAttachmentUpload(
  matchId: string,
  file: File,
): Promise<ChatAttachmentUpload> {
  const result = await unwrap(
    createAttachmentUploadAction({
      matchId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  )
  return {
    path: result.path,
    signedUrl: result.signedUrl,
    token: result.token,
  }
}

/**
 * POST the raw file bytes to the signed upload URL returned by the grant.
 * Supabase's signed-upload route is one-shot POST (not PUT) with the
 * `Content-Type` and `x-upsert` headers; the grant URL already embeds the
 * storage token, so an `!response.ok` (or a thrown fetch) is a terminal
 * failure — the caller must not send the message after this rejects.
 */
export async function uploadChatAttachment(
  file: File,
  signedUrl: string,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(signedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    })
  } catch (cause) {
    throw new Error('Attachment upload could not be started.', { cause })
  }
  if (!response.ok) {
    throw new Error(await uploadErrorDetail(response))
  }
}

/** Best-effort extraction of the storage error body for a failed upload POST. */
async function uploadErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string } | null
    if (body?.message) {
      return `Attachment upload failed (HTTP ${response.status}): ${body.message}`
    }
  } catch {
    // Non-JSON error body — fall through to the generic message below.
  }
  return `Attachment upload failed (HTTP ${response.status}).`
}
