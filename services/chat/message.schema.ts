// src/services/chat/message.schema.ts
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'
import { containsDenylisted } from '@/lib/moderation/denylist'
import { logger } from '@/lib/logger'

/**
 * Send Message Schema
 *
 * Validates incoming chat messages.
 *
 * Business rules:
 * - `matchId` must be a valid UUID
 * - `content` must be between 1 and 2000 characters (DB parity:
 *   `messages.content` has `check (char_length(content) between 1 and 2000)`
 *   in 20260804204014_init.sql — the trust boundary must reject anything the
 *   DB cannot store so an oversized send fails with a clean VALIDATION error,
 *   never a 500 after a partial side effect). An empty/whitespace-only body is
 *   only permitted for an attachment-only send (attachmentUrl present); the
 *   service substitutes a non-empty caption before insert.
 * - `content` is trimmed, NOT whitespace-collapsed: byte-identical to the
 *   composer's `cleanComposerText` (lib/chat/composer-input.ts). The realtime
 *   merge swaps the optimistic row on (senderId, content), so any server-side
 *   rewrite of the text would never match the optimistic copy and would
 *   surface as a duplicate message.
 * - `content` must not contain denylisted terms
 * - an empty body with no attachment is rejected in the service layer with a
 *   clean VALIDATION error, never a 500
 * - `clientMessageId` is a UUID for idempotency (client‑generated)
 * - `attachmentUrl` is an optional canonical storage object path restricted to
 *   the `match-attachments/` bucket. This is a cheap shape guard only; strict
 *   match-scoped ownership is enforced in the service layer
 *   (`isValidAttachmentPath` + authorized existence probe), so a path for a
 *   DIFFERENT match passes here and is rejected there.
 *
 * Additional validation (e.g., match exists, sender is participant)
 * is handled in the service layer (Session 3.5).
 */
export const sendMessageSchema = z
  .object({
    matchId: uuidSchema,
    content: z
      .string()
      .max(2000, { message: 'Message exceeds 2000 characters.' })
      .refine((val) => !containsDenylisted(val), {
        message: 'Message contains inappropriate language. Please rephrase.',
      })
      .transform((val) => {
        // Trim ONLY — byte-identical to the composer's cleanComposerText so
        // the optimistic copy and the persisted copy can never disagree (the
        // realtime merge swaps optimistic rows on senderId+content; collapsing
        // whitespace here would break that swap and surface as duplicates).
        const trimmed = val.trim()
        logger.debug('Message content validated', {
          originalLength: val.length,
          trimmedLength: trimmed.length,
        })
        return trimmed
      }),
    clientMessageId: uuidSchema.describe(
      'Client‑generated UUID for deduplication',
    ),
    // Canonical storage object path (see lib/chat/attachment.ts). Absolute
    // URLs are rejected — external links are not attachment storage; strict
    // match/ownership validation happens in chat.service via
    // isValidAttachmentPath.
    attachmentUrl: z
      .string()
      .min(1)
      .max(512)
      .startsWith('match-attachments/')
      .optional(),
  })
  .strict()

export type SendMessageInput = z.infer<typeof sendMessageSchema>

// ─── DTO for service layer ──────────────────────────────
export interface SendMessageContext {
  matchId: string
  senderId: string
  content: string
  clientMessageId: string
  attachmentUrl?: string
}
