// src/app/actions/inbox.ts
// Chat inbox read boundary: wraps getInbox (chat_threads projection + empty matches).
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { toErrorPayload } from '@/lib/errors'
import {
  getInbox,
  type InboxCursor,
  type InboxPage,
} from '@/services/chat/chat.service'

const inboxInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z
      .object({
        lastMessageAt: z.string(),
        matchId: z.string(),
      })
      .optional(),
  })
  .strict()

export async function getInboxAction(input?: {
  limit?: number
  cursor?: InboxCursor
}): Promise<InboxPage | { ok: false; error: string }> {
  try {
    const userId = await requireUser()
    const parsed = inboxInputSchema.safeParse(input ?? {})
    if (!parsed.success) {
      return { ok: false, error: toErrorPayload(parsed.error).message }
    }
    return getInbox(userId, {
      ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
    })
  } catch (error) {
    return { ok: false, error: toErrorPayload(error).message }
  }
}
