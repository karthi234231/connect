// src/services/matching/request-intro.schema.ts
import { z } from 'zod'
import { uuidSchema } from '@/lib/validation'
import { containsDenylisted } from '@/lib/moderation/denylist'
import { logger } from '@/lib/logger'

/**
 * Request Intro Schema
 *
 * Validates the "request intro" action where a user asks to be introduced
 * to another user after a mutual match.
 *
 * Business rules enforced here:
 * - matchId must be a valid UUID
 * - message must be between 1 and 500 characters
 * - message must not contain denylisted terms
 *
 * Additional validation (e.g., match exists, user is participant) is
 * handled at the service layer (Session 3.4).
 */
export const requestIntroSchema = z
  .object({
    matchId: uuidSchema,
    message: z
      .string()
      .min(1, { message: 'Intro message is required.' })
      .max(500, { message: 'Intro message must not exceed 500 characters.' })
      .refine((val) => !containsDenylisted(val), {
        message: 'Message contains inappropriate language. Please rephrase.',
      })
      .transform((val) => {
        // Trim extra whitespace
        const trimmed = val.trim()
        // Log potential PII-safe metadata (no actual content)
        logger.debug('Intro message validated', {
          length: trimmed.length,
          hasContent: trimmed.length > 0,
        })
        return trimmed
      }),
  })
  .strict()

export type RequestIntroInput = z.infer<typeof requestIntroSchema>

// ─── Extended DTO for service layer ────────────────────
export interface RequestIntroContext {
  matchId: string
  message: string
  senderId: string
  recipientId: string
}
