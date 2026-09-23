// src/services/chat/mappers.ts
// Pure, client-safe mappers — no server-only imports.

export interface Message {
  id: string
  matchId: string
  senderId: string
  content: string
  attachmentUrl?: string | null
  readAt?: string | null
  createdAt: string
}

/** Shape of a `messages` DB row (columns consumed by this mapper). */
export interface MessageRow {
  id: string
  match_id: string
  sender_id: string
  content: string
  attachment_url?: string | null
  read_at?: string | null
  created_at: string
}

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    content: row.content,
    attachmentUrl: row.attachment_url,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}
