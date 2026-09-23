// src/app/actions/feedback.ts
// Feedback boundary action: validates with the shared feedback schema and
// inserts into the `feedback` table. Auth-gated (requireUser) — feedback is
// always submitted from inside the dashboard. The table only has
// message/context/user_id columns, so optional schema fields (rating, email)
// are not persisted; the form surfaces message + context only.
'use server'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { feedbackSchema } from '@/services/feedback/feedback.schema'

export interface FeedbackSubmissionResult {
  ok: true
}

export async function submitFeedbackAction(input: {
  message: string
  context?: string
}): Promise<FeedbackSubmissionResult> {
  const userId = await requireUser()

  const parsed = feedbackSchema.safeParse({
    message: input.message,
    context: input.context,
  })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      parsed.error?.message ?? 'Please check the information you entered.',
    )
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    message: parsed.data.message,
    context: parsed.data.context ?? '',
  })

  if (error) {
    logger.error('submitFeedback: insert failed', {
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Feedback could not be saved.', {
      cause: error,
    })
  }

  return { ok: true }
}
