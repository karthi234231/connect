// src/app/actions/safety.ts
// Safety mutations (block / report). Actor is always the verified session;
// inputs are zod-.strict() validated before any service call.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { uuidSchema } from '@/lib/validation'
import {
  blockUser,
  listBlockedUsers,
  reportUser,
  reportReasonSchema,
  unblockUser,
  type BlockedUser,
} from '@/services/safety/safety.service'

export type ReportReason = z.infer<typeof reportReasonSchema>

const blockInputSchema = z.object({ blockedUserId: uuidSchema }).strict()

const reportInputSchema = z
  .object({
    reportedId: uuidSchema,
    reason: reportReasonSchema,
    note: z.string().trim().max(500).optional(),
  })
  .strict()

export async function blockUserAction(blockedUserId: string): Promise<void> {
  const userId = await requireUser()

  const parsed = blockInputSchema.safeParse({ blockedUserId })

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That account cannot be blocked.')
  }

  await blockUser(userId, parsed.data.blockedUserId)
}

/** Remove the caller's own block on another user (P0-24). */
export async function unblockUserAction(blockedUserId: string): Promise<void> {
  const userId = await requireUser()

  const parsed = blockInputSchema.safeParse({ blockedUserId })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'That account cannot be unblocked.',
    )
  }

  await unblockUser(userId, parsed.data.blockedUserId)
}

/** The caller's own block list for the safety settings page (P0-24). */
export async function getBlockedUsersAction(): Promise<BlockedUser[]> {
  const userId = await requireUser()
  return listBlockedUsers(userId)
}

export async function reportUserAction(
  reportedId: string,
  reason: ReportReason,
  note?: string,
): Promise<void> {
  const userId = await requireUser()

  const parsed = reportInputSchema.safeParse({ reportedId, reason, note })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'Please pick a valid reason for the report.',
    )
  }

  await reportUser(userId, {
    reportedId: parsed.data.reportedId,
    reason: parsed.data.reason,
    note: parsed.data.note,
  })
}
