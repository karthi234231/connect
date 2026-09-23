// src/services/ideas/idea.service.ts
// Idea-first discovery domain service (W3.4).
// Follows the Web plan §7.2 privacy model: full identity is approval-gated.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { writeAuditLog, AuditActions } from '@/lib/audit'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import type { Database } from '@/types/database'

import {
  type SubmitIdeaInput,
  type UpdateIdeaInput,
  type ToggleJoinEnabledInput,
  type ValidateIdeaInput,
  type RequestJoinInput,
  type ReviewJoinInput,
  type IdeaCardDTO,
  type IdeaDetailDTO,
  type JoinRequestDTO,
  ideaJoinReviewResultSchema,
} from './idea.schema'
import { createIdeaRevision } from './revisions'

// ─── Row → DTO helpers ─────────────────────────────────────

interface IdeaRow {
  id: string
  owner_id: string
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  team_needed: string[]
  tags: string[]
  visibility: string
  join_enabled: boolean
  validation_count: number
  image_url?: string | null
  created_at: string
  owner_role?: string | null
}

function toIdeaCardDTO(row: IdeaRow): IdeaCardDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    ask: row.ask,
    stage: row.stage,
    teamNeeded: row.team_needed || [],
    tags: row.tags || [],
    validationCount: row.validation_count ?? 0,
    joinEnabled: row.join_enabled,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    owner: {
      id: row.owner_id,
      role: row.owner_role ?? null,
    },
  }
}

// ─── Idea ranking ──────────────────────────────────────────
// Feed model:
// relevance 70% + novelty/exploration 20% + freshness 10%
//
// Relevance internally combines:
// quality + validation signal + creator signal + filter fit.
// Creator signal is intentionally lightweight because the current source
// does not expose a dedicated creator reputation/credibility field.

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeValidationCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0
  }

  return clamp(Math.log1p(count) / Math.log1p(100))
}

function normalizeLength(value: string, target: number): number {
  return clamp(value.trim().length / target)
}

function qualityScore(row: IdeaRow): number {
  const title = normalizeLength(row.title, 40)

  const problem = normalizeLength(row.problem, 180)

  const solution = normalizeLength(row.solution, 220)

  const ask = normalizeLength(row.ask, 100)

  const structure = clamp(
    ((row.team_needed?.length ?? 0) + (row.tags?.length ?? 0)) / 6,
  )

  return clamp(
    title * 0.1 +
      problem * 0.3 +
      solution * 0.35 +
      ask * 0.15 +
      structure * 0.1,
  )
}

function creatorSignal(row: IdeaRow): number {
  return row.owner_role?.trim() ? 1 : 0.5
}

function filterFitScore(
  row: IdeaRow,
  filters?: {
    stage?: string
    tag?: string
    own?: boolean
    joinEnabled?: boolean
  },
): number {
  let score = 0.5

  if (filters?.stage && row.stage === filters.stage) {
    score += 0.25
  }

  if (
    filters?.tag &&
    row.tags?.some((tag) => tag.toLowerCase() === filters.tag?.toLowerCase())
  ) {
    score += 0.25
  }

  if (filters?.joinEnabled && row.join_enabled) {
    score += 0.1
  }

  return clamp(score)
}

function relevanceScore(
  row: IdeaRow,
  filters?: {
    stage?: string
    tag?: string
    own?: boolean
    joinEnabled?: boolean
  },
): number {
  const quality = qualityScore(row)

  const validation = normalizeValidationCount(row.validation_count)

  const creator = creatorSignal(row)

  const fit = filterFitScore(row, filters)

  return clamp(quality * 0.45 + validation * 0.3 + creator * 0.1 + fit * 0.15)
}

function freshnessScore(createdAt: string): number {
  const timestamp = Date.parse(createdAt)

  if (Number.isNaN(timestamp)) {
    return 0
  }

  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000)

  return Math.exp(-ageDays / 14)
}

function stableHash(input: string): number {
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)

    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 4294967295
}

function explorationScore(row: IdeaRow, position: number): number {
  const dayKey = new Date().toISOString().slice(0, 10)

  const stable = stableHash(`${dayKey}:${row.id}`)

  const tagPenalty = row.tags && row.tags.length > 0 ? 0 : 0.08

  return clamp(stable + tagPenalty - position * 0.002)
}

function noveltyScore(row: IdeaRow, tagFrequency: Map<string, number>): number {
  if (!row.tags || row.tags.length === 0) {
    return 0.5
  }

  const rarityValues = row.tags.map((tag) => {
    const frequency = tagFrequency.get(tag.toLowerCase()) ?? 1

    return 1 / Math.sqrt(frequency)
  })

  const average =
    rarityValues.reduce((sum, value) => sum + value, 0) / rarityValues.length

  return clamp(average)
}

function rankIdeas(
  rows: IdeaRow[],
  filters?: {
    stage?: string
    tag?: string
    own?: boolean
    joinEnabled?: boolean
  },
): IdeaRow[] {
  const tagFrequency = new Map<string, number>()

  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const key = tag.toLowerCase()

      tagFrequency.set(key, (tagFrequency.get(key) ?? 0) + 1)
    }
  }

  return rows
    .map((row, position) => {
      const relevance = relevanceScore(row, filters)

      const novelty = noveltyScore(row, tagFrequency)

      const exploration = explorationScore(row, position)

      const freshness = freshnessScore(row.created_at)

      const discoveryScore =
        relevance * 0.7 +
        (novelty * 0.6 + exploration * 0.4) * 0.2 +
        freshness * 0.1

      return {
        row,
        discoveryScore,
      }
    })
    .sort((left, right) => {
      if (right.discoveryScore !== left.discoveryScore) {
        return right.discoveryScore - left.discoveryScore
      }

      return right.row.created_at.localeCompare(left.row.created_at)
    })
    .map(({ row }) => row)
}

// ─── Create / update ───────────────────────────────────────

export async function submitIdea(
  userId: string,
  input: SubmitIdeaInput,
): Promise<IdeaCardDTO> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      owner_id: userId,
      title: input.title,
      problem: input.problem,
      solution: input.solution,
      ask: input.ask,
      stage: input.stage,
      team_needed: input.teamNeeded,
      tags: input.tags,
      visibility: input.visibility,
      join_enabled: input.joinEnabled,
    })
    .select('*, profiles!ideas_owner_id_fkey(role)')
    .single()

  if (error) {
    logger.error('Failed to submit idea', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to submit idea', {
      cause: error,
    })
  }

  logger.info('Idea submitted', {
    ideaId: data.id,
    userId,
  })

  return toIdeaCardDTO({
    ...data,
    owner_role: data.profiles?.role ?? null,
  })
}

export async function updateIdea(
  userId: string,
  ideaId: string,
  input: UpdateIdeaInput,
): Promise<IdeaCardDTO> {
  const supabase = await createServerSupabaseClient()

  const { data: previous, error: previousError } = await supabase
    .from('ideas')
    .select(
      'title, problem, solution, ask, stage, team_needed, tags, visibility, join_enabled',
    )
    .eq('id', ideaId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (previousError) {
    logger.error('Failed to read idea before revision', {
      ideaId,
      userId,
      error: previousError.message,
    })

    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to read idea before update',
      {
        cause: previousError,
      },
    )
  }

  if (!previous) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Idea not found')
  }

  const { data, error } = await supabase
    .from('ideas')
    .update({
      ...(input.title !== undefined
        ? {
            title: input.title,
          }
        : {}),
      ...(input.problem !== undefined
        ? {
            problem: input.problem,
          }
        : {}),
      ...(input.solution !== undefined
        ? {
            solution: input.solution,
          }
        : {}),
      ...(input.ask !== undefined
        ? {
            ask: input.ask,
          }
        : {}),
      ...(input.stage !== undefined
        ? {
            stage: input.stage,
          }
        : {}),
      ...(input.teamNeeded !== undefined
        ? {
            team_needed: input.teamNeeded,
          }
        : {}),
      ...(input.tags !== undefined
        ? {
            tags: input.tags,
          }
        : {}),
      ...(input.visibility !== undefined
        ? {
            visibility: input.visibility,
          }
        : {}),
      ...(input.joinEnabled !== undefined
        ? {
            join_enabled: input.joinEnabled,
          }
        : {}),
    })
    .eq('id', ideaId)
    .eq('owner_id', userId)
    .select('*, profiles!ideas_owner_id_fkey(role)')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Idea not found')
    }

    logger.error('Failed to update idea', {
      ideaId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to update idea', {
      cause: error,
    })
  }

  logger.info('Idea updated', {
    ideaId,
    userId,
  })

  await createIdeaRevision(userId, ideaId, {
    title: previous.title,
    problem: previous.problem,
    solution: previous.solution,
    ask: previous.ask,
    stage: previous.stage,
    teamNeeded: previous.team_needed || [],
    tags: previous.tags || [],
    visibility: previous.visibility,
    joinEnabled: previous.join_enabled,
  }).catch((revisionError) => {
    logger.warn('Failed to write idea revision (non-fatal)', {
      ideaId,
      userId,
      error: revisionError instanceof Error ? revisionError.message : 'unknown',
    })
  })

  return toIdeaCardDTO({
    ...data,
    owner_role: data.profiles?.role ?? null,
  })
}

// ─── List / get ────────────────────────────────────────────

const IDEA_PAGE_SIZE = 20
const IDEA_POOL_CAP = 100

export async function listIdeas(
  userId: string | null,
  filters?: {
    stage?: string
    tag?: string
    own?: boolean
    joinEnabled?: boolean
  },
  limit = IDEA_PAGE_SIZE,
  offset = 0,
): Promise<{
  ideas: IdeaCardDTO[]
  hasMore: boolean
}> {
  const supabase = await createServerSupabaseClient()

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50)
  const safeOffset = Math.max(Math.trunc(offset), 0)

  let query = supabase
    .from('ideas')
    .select('*, profiles!ideas_owner_id_fkey(role)')
    .order('created_at', {
      ascending: false,
    })
    .limit(IDEA_POOL_CAP) // S041 — bounded ranked pool; offset slices AFTER ranking.

  if (filters?.own) {
    if (!userId) {
      return {
        ideas: [],
        hasMore: false,
      }
    }

    query = query.eq('owner_id', userId)
  } else {
    query = query.eq('visibility', 'published')
  }

  if (filters?.stage) {
    query = query.eq(
      'stage',
      filters.stage as Database['public']['Enums']['idea_stage'],
    )
  }

  if (filters?.tag) {
    query = query.contains('tags', [filters.tag])
  }

  if (filters?.joinEnabled) {
    query = query.eq('join_enabled', true)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to list ideas', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to list ideas', {
      cause: error,
    })
  }

  const rawRows = (data ?? []) as Array<
    IdeaRow & { profiles?: { role?: string | null } | null }
  >

  const rows = rawRows.map((row) => ({
    ...row,
    owner_role: row.profiles?.role ?? null,
  })) as IdeaRow[]

  // S041 — rank the whole pool once, then page: stable order across refills.
  const ranked = rankIdeas(rows, filters)

  const page = ranked.slice(safeOffset, safeOffset + safeLimit)
  const hasMore = safeOffset + safeLimit < ranked.length

  return {
    ideas: page.map(toIdeaCardDTO),
    hasMore,
  }
}

export async function getIdea(
  userId: string | null,
  ideaId: string,
): Promise<IdeaDetailDTO> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('ideas')
    .select('*, profiles!ideas_owner_id_fkey(role)')
    .eq('id', ideaId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Idea not found')
    }

    logger.error('Failed to get idea', {
      ideaId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to get idea', {
      cause: error,
    })
  }

  const isOwner = userId === data.owner_id

  // #121 — app-explicit visibility: RLS is the second layer, not the only
  // one. A non-owner reading a non-published idea gets NOT_FOUND (existence
  // is not leaked), regardless of which client pathway reaches this code.
  if (!isOwner && data.visibility !== 'published') {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Idea not found')
  }

  const card = toIdeaCardDTO({
    ...data,
    owner_role: data.profiles?.role ?? null,
  })

  let joinStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none'

  if (userId) {
    const { data: joinRow, error: joinError } = await supabase
      .from('join_requests')
      .select('status')
      .eq('idea_id', ideaId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!joinError && joinRow) {
      // S33 — "joined" is authoritative-only: an approved request that left
      // no membership row (e.g. member removed afterward) must NOT keep
      // rendering "Approved — you're on the team". Cross-check membership.
      if (joinRow.status === 'approved' && !isOwner) {
        const { data: memberRow, error: memberError } = await supabase
          .from('team_memberships')
          .select('user_id')
          .eq('idea_id', ideaId)
          .eq('user_id', userId)
          .maybeSingle()

        joinStatus =
          !memberError && memberRow
            ? 'approved'
            : // Request says approved but no membership exists — surface the
              // last *authoritative* truth (not joined), never "Approved".
              'none'
      } else {
        joinStatus = joinRow.status
      }
    }
  }

  return {
    ...card,
    visibility: data.visibility,
    isOwner,
    canJoin: !!userId && data.join_enabled && !isOwner && joinStatus === 'none',
    joinStatus,
  }
}

// ─── Owner controls ────────────────────────────────────────

export async function toggleJoinEnabled(
  userId: string,
  input: ToggleJoinEnabledInput,
): Promise<{
  ideaId: string
  joinEnabled: boolean
}> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('ideas')
    .update({
      join_enabled: input.joinEnabled,
    })
    .eq('id', input.ideaId)
    .eq('owner_id', userId)
    .select('id, join_enabled')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Idea not found')
    }

    logger.error('Failed to toggle join enabled', {
      ideaId: input.ideaId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to toggle join', {
      cause: error,
    })
  }

  logger.info('Join toggle updated', {
    ideaId: input.ideaId,
    userId,
    joinEnabled: input.joinEnabled,
  })

  return {
    ideaId: data.id,
    joinEnabled: data.join_enabled,
  }
}

// ─── Validation ───────────────────────────────────────────

export async function validateIdea(
  userId: string,
  input: ValidateIdeaInput,
): Promise<{
  ideaId: string
  action: string
  validationCount: number
}> {
  const supabase = await createServerSupabaseClient()

  // Atomic RPC: locks the idea row, upserts the interest, conditionally
  // increments the counter, and returns authoritative counts. Replaces the
  // previous read-modify-write which lost updates under concurrency.
  const { data, error: rpcError } = await supabase.rpc('validate_idea', {
    p_idea_id: input.ideaId,
    p_action: input.action,
  } as never)

  if (rpcError) {
    logger.error('Failed to validate idea', {
      ideaId: input.ideaId,
      userId,
      error: rpcError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to validate idea', {
      cause: rpcError,
    })
  }

  const result = (data ?? {}) as {
    validation_count?: number
    interest_count?: number
  }

  await trackFunnel({
    eventName:
      input.action === 'pass'
        ? FunnelEvents.IdeaPassed
        : FunnelEvents.IdeaValidated,
    actorId: userId,
    entityType: 'idea',
    entityId: input.ideaId,
    result: input.action,
    surface: 'idea_feed',
  })

  logger.info('Idea validated', {
    ideaId: input.ideaId,
    userId,
    action: input.action,
  })

  return {
    ideaId: input.ideaId,
    action: input.action,
    validationCount: Number(result.validation_count ?? 0),
  }
}

// ─── Join request workflow ─────────────────────────────────

export async function requestJoin(
  userId: string,
  input: RequestJoinInput,
): Promise<{
  joinRequestId: string
}> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('join_requests')
    .insert({
      idea_id: input.ideaId,
      user_id: userId,
      status: 'pending',
      message: input.message || null,
    })
    .select('id')
    .single()

  if (error) {
    // #122 — the DB enforces UNIQUE (idea_id, user_id): one request per
    // user/idea, ever. Surface that deterministically (spamming join cannot
    // create unlimited rows) instead of a generic failure.
    if (error.code === '23505') {
      throw new AppError(
        ErrorCodes.VALIDATION,
        'You have already requested to join this idea.',
      )
    }

    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('row-level security')
    ) {
      logger.warn('Join request blocked by policy', {
        ideaId: input.ideaId,
        userId,
        error: error.message,
      })

      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Join request is not currently open for this idea, or you already requested to join.',
      )
    }

    logger.error('Failed to request join', {
      ideaId: input.ideaId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to request join', {
      cause: error,
    })
  }

  await trackFunnel({
    eventName: FunnelEvents.JoinRequested,
    actorId: userId,
    entityType: 'idea',
    entityId: input.ideaId,
    result: 'pending',
    surface: 'idea_feed',
  })

  logger.info('Join requested', {
    ideaId: input.ideaId,
    userId,
    joinRequestId: data.id,
  })

  return {
    joinRequestId: data.id,
  }
}

export async function reviewJoin(
  userId: string,
  input: ReviewJoinInput,
): Promise<{
  joinRequestId: string
  status: 'approved' | 'rejected'
}> {
  const supabase = await createServerSupabaseClient()

  // S02-TODO-B unit 4: one atomic SECURITY DEFINER transaction — owner-only,
  // conditional pending→approved|rejected, idempotent team_memberships upsert
  // on approve, plus idea-mismatch guard. Identity comes from auth.uid()
  // inside the RPC; the client-supplied userId is only a mirror for logging.
  const { data: rpc, error } = await supabase.rpc('review_idea_join_request', {
    p_join_request_id: input.joinRequestId,
    p_idea_id: input.ideaId,
    p_decision: input.decision,
  })

  if (error) {
    logger.error('Failed to review join request', {
      joinRequestId: input.joinRequestId,
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to review join request', {
      cause: error,
    })
  }

  const result = ideaJoinReviewResultSchema.safeParse(rpc)
  if (!result.success || result.data.ok !== true) {
    const reason = result.success
      ? (result.data.reason ?? 'not_found')
      : 'not_found'
    logger.warn('Join review rejected', {
      joinRequestId: input.joinRequestId,
      ideaId: input.ideaId,
      userId,
      reason,
    })
    throw new AppError(ErrorCodes.NOT_FOUND, 'Join request not found')
  }

  const status =
    result.data.status ??
    (input.decision === 'approve' ? 'approved' : 'rejected')

  await trackFunnel({
    eventName:
      status === 'approved'
        ? FunnelEvents.JoinApproved
        : FunnelEvents.JoinRejected,
    actorId: userId,
    entityType: 'idea',
    entityId: input.ideaId,
    result: status,
    surface: 'idea_owner_queue',
  })

  logger.info('Join request reviewed', {
    joinRequestId: input.joinRequestId,
    ideaId: input.ideaId,
    reviewerId: userId,
    status,
  })

  return {
    joinRequestId: input.joinRequestId,
    status,
  }
}

/** Raw join-request row (incl. nested applicant profile from the FK join). */
interface JoinRequestRow {
  id: string
  idea_id: string
  user_id: string
  status: string
  message?: string | null
  created_at: string
  profiles?: {
    id: string
    full_name: string
    avatar_url?: string | null
    role?: string | null
  } | null
}

export async function listJoinRequests(
  ownerId: string,
  ideaId: string,
  status?: 'pending' | 'approved' | 'rejected',
): Promise<JoinRequestDTO[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('join_requests')
    .select(
      '*, profiles!join_requests_user_id_fkey(id, full_name, avatar_url, role)',
    )
    .eq('idea_id', ideaId)
    .order('created_at', {
      ascending: true,
    })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to list join requests', {
      ideaId,
      ownerId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load join requests', {
      cause: error,
    })
  }

  return (data || []).map((row: JoinRequestRow) => ({
    id: row.id,
    ideaId: row.idea_id,
    userId: row.user_id,
    status: row.status as 'pending' | 'approved' | 'rejected',
    message: row.message || undefined,
    createdAt: row.created_at,
    applicant: row.profiles
      ? {
          id: row.profiles.id,
          fullName: row.profiles.full_name,
          avatarUrl: row.profiles.avatar_url ?? null,
          role: row.profiles.role ?? null,
        }
      : undefined,
  }))
}

export async function revealIdeaOwner(
  userId: string,
  ideaId: string,
): Promise<{
  id: string
  fullName: string
  avatarUrl: string | null
  role: string | null
} | null> {
  const supabase = await createServerSupabaseClient()

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('owner_id')
    .eq('id', ideaId)
    .single()

  if (ideaError) {
    if (ideaError.code === 'PGRST116') {
      return null
    }

    logger.error('Failed to load idea for reveal', {
      ideaId,
      error: ideaError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to reveal idea owner', {
      cause: ideaError,
    })
  }

  if (idea.owner_id === userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', userId)
      .single()

    return profile
      ? {
          id: profile.id,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          role: profile.role,
        }
      : null
  }

  const { data: membership, error: membershipError } = await supabase
    .from('team_memberships')
    .select('user_id')
    .eq('idea_id', ideaId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    logger.warn('Failed to check membership for reveal', {
      ideaId,
      userId,
      error: membershipError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to verify access', {
      cause: membershipError,
    })
  }

  if (!membership) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Identity is revealed only after your join is approved.',
    )
  }

  await writeAuditLog({
    actorId: userId,
    actorType: 'user',
    action: AuditActions.IdeaIdentityRevealed,
    entityType: 'idea',
    entityId: ideaId,
    metadata: {
      revealer: userId,
    },
  })

  await trackFunnel({
    eventName: FunnelEvents.IdentityRevealed,
    actorId: userId,
    entityType: 'idea',
    entityId: ideaId,
    result: 'revealed',
    surface: 'idea_join',
  })

  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .eq('id', idea.owner_id)
    .single()

  if (ownerError) {
    logger.error('Failed to load owner profile for reveal', {
      ideaId,
      error: ownerError.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to reveal idea owner', {
      cause: ownerError,
    })
  }

  return owner
    ? {
        id: owner.id,
        fullName: owner.full_name,
        avatarUrl: owner.avatar_url,
        role: owner.role,
      }
    : null
}

export { listJoinRequests as listJoinRequestsForIdea }
