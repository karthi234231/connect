// src/services/feedback/feedback.schema.ts
import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Feedback Schema
 *
 * Captures user feedback for dogfooding and iteration.
 * All fields are validated with strict typing and logging.
 *
 * Business rules:
 * - `message` must be between 1 and 1000 characters
 * - `context` is optional metadata (e.g., page URL, feature name)
 * - `rating` is optional 1-5 scale
 * - `userEmail` is optional but logged (for follow‑up)
 *
 * PII redaction is handled in the logger utility.
 */
export const feedbackSchema = z
  .object({
    message: z
      .string()
      .min(1, { message: 'Feedback message is required.' })
      .max(1000, {
        message: 'Feedback message must not exceed 1000 characters.',
      })
      .transform((val) => {
        const trimmed = val.trim()
        logger.debug('Feedback message validated', {
          length: trimmed.length,
        })
        return trimmed
      }),
    context: z
      .string()
      .max(200, { message: 'Context must not exceed 200 characters.' })
      .optional()
      .transform((val) => val?.trim()),
    rating: z
      .number()
      .int({ message: 'Rating must be an integer.' })
      .min(1, { message: 'Rating must be between 1 and 5.' })
      .max(5, { message: 'Rating must be between 1 and 5.' })
      .optional(),
    userEmail: z
      .string()
      .email({ message: 'Invalid email address.' })
      .optional()
      .transform((val) => val?.toLowerCase().trim()),
  })
  .strict()

export type FeedbackInput = z.infer<typeof feedbackSchema>

// ─── DTO for service layer ──────────────────────────────
export interface FeedbackContext {
  message: string
  context?: string
  rating?: number
  userId?: string
  userEmail?: string
}

// ─── Sanitized version for internal use ─────────────────
export function sanitizeFeedback(raw: unknown): FeedbackInput {
  const result = feedbackSchema.safeParse(raw)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    logger.warn('Invalid feedback provided', {
      errors,
      rawType: typeof raw,
    })
    // Instead of returning a fake message, rethrow with a clear error
    throw new Error(`Invalid feedback: ${JSON.stringify(errors)}`)
  }
  logger.debug('Feedback parsed', {
    hasRating: result.data.rating !== undefined,
    hasContext: !!result.data.context,
    hasEmail: !!result.data.userEmail,
  })
  return result.data
}

// ─── Factory function for creating a valid feedback object ─
export function createFeedback(data: FeedbackInput): FeedbackInput {
  return feedbackSchema.parse(data)
}

// ─── Partial update schema ──────────────────────────────
export const feedbackUpdateSchema = feedbackSchema.partial()
export type FeedbackUpdateInput = z.infer<typeof feedbackUpdateSchema>
