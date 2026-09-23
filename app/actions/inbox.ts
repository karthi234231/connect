// src/app/actions/inbox.ts
// Chat inbox read boundary: wraps getInbox (chat_threads projection + empty matches).
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { getInbox, type InboxPage } from '@/services/chat/chat.service'

const inboxInputSchema = z
  .object({ limit: z.number().int().min(1).max(50).optional() })
  .strict()

export async function getInboxAction(input?: {
  limit?: number
}): Promise<InboxPage> {
  const userId = await requireUser()
  const parsed = inboxInputSchema.safeParse(input ?? {})
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That inbox request is not valid.',
    )
  }
  return getInbox(userId, parsed.data.limit ? { limit: parsed.data.limit } : {})
}
