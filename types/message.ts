import type { Tables } from '@/types/database'

export type MessageRow = Tables<'messages'>
export type ChatThreadRow = Tables<'chat_threads'>

export interface MessageDraft {
  matchId: string
  content: string
  clientMessageId?: string
  attachmentUrl?: string
}

export type MessageSummary = Pick<
  MessageRow,
  'id' | 'content' | 'created_at' | 'sender_id' | 'read_at' | 'attachment_url'
>

export interface ChatThreadSummary {
  matchId: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  lastMessageSenderId: string | null
  unread: number
}
