// src/services/chat/reaction.schema.ts
// P0-12 — reaction trust boundary. .strict() so unknown keys reject (§381),
// emoji constrained to the shared allowlist.

import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'
import { MESSAGE_REACTIONS } from '@/lib/chat/reactions'

// Loose `string` elements keep ToggleReactionInput callable by consumers that
// type emoji as plain string; the z.enum allowlist is enforced at parse time
// (the runtime trust boundary), never widened at the boundary.
const emojiSchema = z.enum(MESSAGE_REACTIONS as unknown as [string, ...string[]])

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
