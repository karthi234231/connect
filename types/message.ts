import type { Tables } from '@/types/database'

/**
 * `messages` table row (Supabase RLS `Tables<'messages'>`).
 *
 * Lineage: DB row → `rowToMessage` (`services/chat/mappers.ts`) → server
 * actions (`getMessagesAction`/`searchMessagesAction`) → `client/api/chat.ts`
 * (`watchMessages`/`searchChatMessages`) → reduced to `MessageSummary` →
 * `app/dashboard/chat/[matchId]/thread-view.tsx`.
 *
 * **`attachment_url` is a canonical STORAGE PATH inside the private
 * `match-attachments` bucket (`lib/chat/attachment.ts`), never a public URL.**
 * It is displayed by resolving a signed URL via `getAttachmentUrl`-style
 * lookup, not by rendering the value directly.
 */
export type MessageRow = Tables<'messages'>

/**
 * `chat_threads` table row (Supabase RLS `Tables<'chat_threads'>`). Per-user
 * unread is stored split as `unread_user1`/`unread_user2`; the inbox service
 * (`getInbox`) picks the caller's side before the value is flattened into
 * `ChatThreadSummary.unread`. This row projects to
 * `services/chat/chat.service.ts#ConversationSummary` → `fetchThreads`
 * (`client/api/chat.ts`) → `ChatThreadSummary`.
 */
export type ChatThreadRow = Tables<'chat_threads'>

/**
 * Client draft for one outgoing message. Consumed by `sendChatMessage`
 * (`client/api/chat.ts`), which forwards it to `sendMessageAction`
 * (`app/actions/chat.ts`) and onward to the `sendMessage` service.
 */
export interface MessageDraft {
  /** The conversation key — a match id (uuid). */
  matchId: string
  /**
   * Message body, 1..2000 chars after trimming. This mirrors the server
   * schema (`sendMessageSchema`) and the composer cap `COMPOSER_MAX_CHARS`
   * in `lib/chat/composer-input.ts`; whitespace-only or empty text is
   * rejected server-side, so the client should guard the same bound.
   */
  content: string
  /**
   * Client-minted idempotency key (uuid) so an optimistic retry can never
   * double-write the thread. The server mints one when omitted
   * (`sendMessageAction`).
   */
  clientMessageId?: string
  /**
   * Canonical STORAGE PATH of an uploaded attachment — **not a public
   * URL**. Shape: `match-attachments/{matchId}/{uuid}.{ext}` inside the
   * private `match-attachments` bucket (see `lib/chat/attachment.ts`).
   * The sender PUTs the bytes to the grant's signed upload URL first, then
   * passes this path on send; at display time the client resolves it to a
   * signed URL via `fetchAttachmentUrl` (`client/api/chat.ts`). The name is
   * legacy — treat the value as a path, never render it directly.
   */
  attachmentUrl?: string
}

/**
 * Client-safe, snake_case projection of one message row as returned by
 * `watchMessages` and `searchChatMessages` (`client/api/chat.ts`). The
 * client adapter maps the service `Message` (camelCase, `services/chat/
 * mappers.ts`) back onto the `MessageRow` column names, and `thread-view.tsx`
 * consumes these fields directly. Every key lines up with `MessageRow`
 * (`sender_id`, `read_at`, `attachment_url`); `read_at` is the per-message
 * receipt timestamp (null until the peer has read it). `sender_id` is the
 * authoring profile id.
 */
export type MessageSummary = Pick<
  MessageRow,
  'id' | 'content' | 'created_at' | 'sender_id' | 'read_at' | 'attachment_url'
>

/**
 * One row of the thread list, produced by `fetchThreads`
 * (`client/api/chat.ts`) from the inbox action (`getInboxAction` →
 * service `getInbox`, `chat_threads` projection) and shaped into
 * `InboxConversationInput` by `lib/chat/inbox-adapter.ts` inside
 * `use-chat-inbox.ts` (`hooks/use-chat-inbox.ts`).
 *
 * The peer identity is intentionally NOT carried here: the inbox hook
 * backfills `otherUserId` from the matches query when building
 * `InboxConversationInput`.
 */
export interface ChatThreadSummary {
  /** The conversation key — a match id (uuid). */
  matchId: string
  /** ISO timestamp of the most recent message; null only for a conversation
   * with no messages yet ("new match"). */
  lastMessageAt: string | null
  /** Display text of the most recent message; null when there are none. */
  lastMessageContent: string | null
  /** Author of the most recent message (profile id); null when there are
   * none. */
  lastMessageSenderId: string | null
  /** Per-viewer unread count for the CURRENT user — the service resolves
   * `unread_user1`/`unread_user2` by caller identity. */
  unread: number
}