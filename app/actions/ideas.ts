// src/app/actions/ideas.ts
// W3.4 — idea-first domain actions. Auth + zod .strict() at the boundary, all
// domain rules in the service layer. Join requests carry an extra user-scoped
// rate limit (#122) on top of the DB UNIQUE(idea_id, user_id) per-idea dedupe.
'use server'

import { z } from 'zod'

import { FunnelEvents, trackFunnel } from '@/lib/analytics/funnel'
import { requireUser } from '@/lib/auth'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { joinRatelimit, checkRateLimit } from '@/lib/ratelimit'
import { uuidSchema } from '@/lib/validation'
import { canSendRequest } from '@/services/profiles/completeness'
import { getProfile } from '@/services/profiles/service'
import {
  listIdeas,
  getIdea,
  listJoinRequests,
  requestJoin,
  reviewJoin,
  submitIdea,
  toggleJoinEnabled,
  updateIdea,
  validateIdea,
} from '@/services/ideas/idea.service'
import {
  listIdeaReactions,
  removeIdeaReaction,
  toggleIdeaReaction,
} from '@/services/ideas/reactions'
import {
  toggleIdeaReactionSchema,
  type IdeaReactionSummary,
  type ToggleIdeaReactionInput,
} from '@/services/ideas/reactions'
import {
  getIdeaRevisions,
  type IdeaRevisionDTO,
} from '@/services/ideas/revisions'
export type { IdeaRevisionDTO }
import {
  requestJoinSchema,
  reviewJoinSchema,
  submitIdeaSchema,
  toggleJoinEnabledSchema,
  updateIdeaSchema,
  validateIdeaSchema,
  type IdeaCardDTO,
  type IdeaDetailDTO,
  type JoinRequestDTO,
  type RequestJoinInput,
  type ReviewJoinInput,
  type SubmitIdeaInput,
  type ToggleJoinEnabledInput,
  type UpdateIdeaInput,
  type ValidateIdeaInput,
} from '@/services/ideas/idea.schema'

/** Feed page size — the client refills when the buffer runs low. */
const IDEA_PAGE_SIZE = 10

const listInputSchema = z
  .object({
    filters: z
      .object({
        stage: z.string().trim().max(30).optional(),
        tag: z.string().trim().max(30).optional(),
        own: z.boolean().optional(),
        joinEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict()

export interface IdeaListResult {
  ideas: IdeaCardDTO[]
  hasMore: boolean
}

/**
 * Edit-form payload. The form's visibility selector exposes one label the DB
 * enum does not model (`private`); it is passed through and the service schema
 * is the authority that rejects it, rather than the client silently dropping it.
 */
export type UpdateIdeaActionInput = Omit<UpdateIdeaInput, 'visibility'> & {
  visibility?: string
}

export async function listIdeasAction(
  filters?: {
    stage?: string
    tag?: string
    own?: boolean
    joinEnabled?: boolean
  },
  limit?: number,
  offset?: number,
): Promise<IdeaListResult> {
  const userId = await requireUser()

  const parsed = listInputSchema.safeParse({ filters, limit, offset })

  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'Those idea filters are not valid.',
    )
  }

  return listIdeas(
    userId,
    parsed.data.filters,
    parsed.data.limit ?? IDEA_PAGE_SIZE,
    parsed.data.offset ?? 0,
  )
}

export async function submitIdeaAction(
  input: SubmitIdeaInput,
): Promise<{ ideaId: string }> {
  const userId = await requireUser()

  const parsed = submitIdeaSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Please check your idea details.')
  }

  const created = await submitIdea(userId, parsed.data)

  return { ideaId: created.id }
}

export async function updateIdeaAction(
  ideaId: string,
  input: UpdateIdeaActionInput,
): Promise<void> {
  const userId = await requireUser()

  const idParsed = uuidSchema.safeParse(ideaId)
  const parsed = updateIdeaSchema.safeParse(input)

  if (!idParsed.success || !parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Please check your idea details.')
  }

  await updateIdea(userId, idParsed.data, parsed.data)
}

export async function validateIdeaAction(
  input: ValidateIdeaInput,
): Promise<void> {
  const userId = await requireUser()

  const parsed = validateIdeaSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That validation is not valid.')
  }

  await validateIdea(userId, parsed.data)

  await trackFunnel({
    eventName:
      parsed.data.action === 'pass'
        ? FunnelEvents.IdeaPassed
        : FunnelEvents.IdeaValidated,
    actorId: userId,
    entityType: 'idea',
    entityId: parsed.data.ideaId,
    result: parsed.data.action,
  })
}

export async function requestJoinAction(
  input: RequestJoinInput,
): Promise<{ joinRequestId: string }> {
  const userId = await requireUser()

  // #122 — bound join-request spraying across ideas within a window.
  const rateLimit = await checkRateLimit(`join:${userId}`, joinRatelimit)

  if (!rateLimit.success) {
    logger.warn('requestJoinAction: rate limited', { userId })
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      "You're sending join requests very quickly. Please try again shortly.",
    )
  }

  const parsed = requestJoinSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That join request is not valid.')
  }

  const profile = await getProfile(userId)

  if (!profile || !canSendRequest(profile)) {
    throw AppError.forbidden(
      'Complete your profile before asking to join an idea.',
    )
  }

  const result = await requestJoin(userId, parsed.data)

  await trackFunnel({
    eventName: FunnelEvents.JoinRequested,
    actorId: userId,
    entityType: 'idea',
    entityId: parsed.data.ideaId,
  })

  return result
}

export async function reviewJoinAction(input: ReviewJoinInput): Promise<void> {
  const userId = await requireUser()

  const parsed = reviewJoinSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That review is not valid.')
  }

  const result = await reviewJoin(userId, parsed.data)

  await trackFunnel({
    eventName:
      result.status === 'approved'
        ? FunnelEvents.JoinApproved
        : FunnelEvents.JoinRejected,
    actorId: userId,
    entityType: 'idea',
    entityId: parsed.data.ideaId,
    result: result.status,
  })
}

/**
 * Fire-and-forget view signal. Analytics failures must never surface to the
 * reader, so the write is best-effort and logged only.
 */
export async function trackIdeaViewedAction(ideaId: string): Promise<void> {
  const parsed = uuidSchema.safeParse(ideaId)

  if (!parsed.success) {
    return
  }

  try {
    const userId = await requireUser()

    await trackFunnel({
      eventName: FunnelEvents.IdeaViewed,
      actorId: userId,
      entityType: 'idea',
      entityId: parsed.data,
    })
  } catch (error) {
    logger.debug('trackIdeaViewedAction: skipped', { error })
  }
}

export async function toggleJoinEnabledAction(
  input: ToggleJoinEnabledInput,
): Promise<void> {
  const userId = await requireUser()

  const parsed = toggleJoinEnabledSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That join setting is not valid.')
  }

  await toggleJoinEnabled(userId, parsed.data)
}

const joinRequestStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export async function getIdeaAction(ideaId: string): Promise<IdeaDetailDTO> {
  const userId = await requireUser()

  const parsed = uuidSchema.safeParse(ideaId)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That idea is not valid.')
  }

  return getIdea(userId, parsed.data)
}

export async function listJoinRequestsAction(
  ideaId: string,
  status?: 'pending' | 'approved' | 'rejected',
): Promise<JoinRequestDTO[]> {
  const userId = await requireUser()

  const idParsed = uuidSchema.safeParse(ideaId)
  const statusParsed = joinRequestStatusSchema.optional().safeParse(status)

  if (!idParsed.success || !statusParsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'Those requests are not valid.')
  }

  return listJoinRequests(userId, idParsed.data, statusParsed.data)
}

export async function approveJoinRequestAction(input: {
  ideaId: string
  joinRequestId: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = z
    .object({ ideaId: uuidSchema, joinRequestId: uuidSchema })
    .strict()
    .safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That approval is not valid.')
  }

  const result = await reviewJoin(userId, {
    ideaId: parsed.data.ideaId,
    joinRequestId: parsed.data.joinRequestId,
    decision: 'approve',
  })

  await trackFunnel({
    eventName: FunnelEvents.JoinApproved,
    actorId: userId,
    entityType: 'idea',
    entityId: parsed.data.ideaId,
    result: result.status,
  })
}

export async function rejectJoinRequestAction(input: {
  ideaId: string
  joinRequestId: string
}): Promise<void> {
  const userId = await requireUser()

  const parsed = z
    .object({ ideaId: uuidSchema, joinRequestId: uuidSchema })
    .strict()
    .safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That rejection is not valid.')
  }

  const result = await reviewJoin(userId, {
    ideaId: parsed.data.ideaId,
    joinRequestId: parsed.data.joinRequestId,
    decision: 'reject',
  })

  await trackFunnel({
    eventName: FunnelEvents.JoinRejected,
    actorId: userId,
    entityType: 'idea',
    entityId: parsed.data.ideaId,
    result: result.status,
  })
}

export async function toggleIdeaReactionAction(
  input: ToggleIdeaReactionInput,
): Promise<{ reacted: boolean }> {
  const userId = await requireUser()

  const parsed = toggleIdeaReactionSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That reaction is not valid.')
  }

  return toggleIdeaReaction(userId, parsed.data)
}

export async function removeIdeaReactionAction(
  input: ToggleIdeaReactionInput,
): Promise<{ reacted: boolean }> {
  const userId = await requireUser()

  const parsed = toggleIdeaReactionSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That reaction is not valid.')
  }

  return removeIdeaReaction(userId, parsed.data)
}

export async function listIdeaReactionsAction(
  ideaId: string,
): Promise<IdeaReactionSummary[]> {
  const userId = await requireUser()

  const parsed = uuidSchema.safeParse(ideaId)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That idea is not valid.')
  }

  return listIdeaReactions(userId, { ideaId: parsed.data })
}

export async function getIdeaRevisionsAction(
  ideaId: string,
): Promise<IdeaRevisionDTO[]> {
  const userId = await requireUser()

  const parsed = uuidSchema.safeParse(ideaId)

  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION, 'That idea is not valid.')
  }

  return getIdeaRevisions(userId, parsed.data)
}

