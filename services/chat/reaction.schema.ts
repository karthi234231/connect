// src/services/chat/reaction.schema.ts
// P0-12 — reaction trust boundary. .strict() so unknown keys reject (§381),
// emoji constrained to the shared allowlist.

import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'
import { MESSAGE_REACTIONS } from '@/lib/chat/reactions'

const emojiSchema = z.enum(
  // `as const` array → non-empty tuple for z.enum.
  MESSAGE_REACTIONS as unknown as [string, ...string[]],
)

export const toggleReactionSchema = z
  .object({
    messageId: uuidSchema,
    emoji: emojiSchema,
  })
  .strict()

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>

export const listReactionsSchema = z
  .object({
    matchId: uuidSchema,
    messageIds: z.array(uuidSchema).min(1).max(100),
  })
  .strict()

export type ListReactionsInput = z.infer<typeof listReactionsSchema>
