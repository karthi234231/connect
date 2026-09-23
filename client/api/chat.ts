import type {
  MessageDraft,
  MessageSummary,
  ChatThreadSummary,
} from '@/types/message'
import {
  createAttachmentUploadAction,
  getAttachmentUrlAction,
  getMessageReactionsAction,
  getMessagesAction,
  getThreadPeerAction,
  markMessagesAsReadAction,
  publishTypingAction,
  removeReactionAction,
  searchMessagesAction,
  sendMessageAction,
  toggleReactionAction,
} from '@/app/actions/chat'
import { getInboxAction } from '@/app/actions/inbox'
import type { ReactionRecord } from '@/lib/chat/reactions'

export interface ThreadPeer {
  fullName: string
  role: string | null
  avatarUrl: string | null
}

export async function fetchThreadPeer(matchId: string): Promise<ThreadPeer> {
  return getThreadPeerAction({ matchId })
}

export interface FetchMessagesOptions {
  matchId: string
  limit?: number
  cursor?: string
}

export interface SearchMessagesOptions {
  query: string
  matchId?: string
}

export async function watchMessages(
  options: FetchMessagesOptions,
): Promise<MessageSummary[]> {
  const page = await getMessagesAction({
    matchId: options.matchId,
    ...(options.limit ? { limit: options.limit } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  })
  return page.messages.map((m) => ({
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    sender_id: m.senderId,
    read_at: m.readAt ?? null,
    attachment_url: m.attachmentUrl ?? null,
  }))
}

export async function sendChatMessage(draft: MessageDraft): Promise<void> {
  await sendMessageAction({
    matchId: draft.matchId,
    content: draft.content,
    ...(draft.clientMessageId
      ? { clientMessageId: draft.clientMessageId }
      : {}),
    ...(draft.attachmentUrl ? { attachmentUrl: draft.attachmentUrl } : {}),
  })
}

export async function markConversationRead(matchId: string): Promise<void> {
  await markMessagesAsReadAction({ matchId })
}

export async function fetchThreads(
  limit?: number,
): Promise<ChatThreadSummary[]> {
  const inbox = await getInboxAction(limit ? { limit } : {})
  return inbox.conversations.map((c) => ({
    matchId: c.matchId,
    lastMessageAt: c.lastMessage?.createdAt ?? null,
    lastMessageContent: c.lastMessage?.content ?? null,
    lastMessageSenderId: c.lastMessage?.senderId ?? null,
    unread: c.unreadCount,
  }))
}

export async function searchChatMessages(
  options: SearchMessagesOptions,
): Promise<MessageSummary[]> {
  const rows = await searchMessagesAction(options)
  return rows.map((m) => ({
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    sender_id: m.senderId,
    read_at: null,
    attachment_url: null,
  }))
}

export async function getChatReactions(
  matchId: string,
  messageIds: string[],
): Promise<ReactionRecord[]> {
  return getMessageReactionsAction({ matchId, messageIds })
}

export async function toggleChatReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  await toggleReactionAction({ messageId, emoji })
}

export async function removeChatReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  await removeReactionAction({ messageId, emoji })
}

export async function fetchAttachmentUrl(path: string): Promise<string> {
  const { signedUrl } = await getAttachmentUrlAction({ path })
  return signedUrl
}

/**
 * Publish ephemeral typing presence (S032). Fire-and-forget from the
 * composer; recipients converge via the realtime envelope, never refetch.
 */
export function publishTyping(matchId: string, isTyping: boolean): void {
  void publishTypingAction({ matchId, isTyping }).catch(() => undefined)
}

export interface ChatAttachmentUpload {
  path: string
  signedUrl: string
  token: string
}

/**
 * Mint a match-scoped attachment upload grant. The server assigns the
 * canonical `match-attachments/{matchId}/{uuid}.{ext}` path; the caller then
 * PUTs the bytes to `signedUrl` and sends a message with `path` as the
 * attachment URL (send-time storage probe re-verifies the object exists).
 */
export async function createChatAttachmentUpload(
  matchId: string,
  file: File,
): Promise<ChatAttachmentUpload> {
  const result = await createAttachmentUploadAction({
    matchId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  })
  return {
    path: result.path,
    signedUrl: result.signedUrl,
    token: result.token,
  }
}

/** Upload the raw bytes to the signed upload URL returned by the grant. */
export async function uploadChatAttachment(
  file: File,
  signedUrl: string,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  })
  if (!response.ok) {
    throw new Error('Attachment upload failed.')
  }
}
