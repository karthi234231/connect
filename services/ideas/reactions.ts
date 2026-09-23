// src/services/ideas/reactions.ts
// Idea reactions — server-authoritative toggle + grouped read for the idea
// detail page's ReactionBar.
//
// Concurrency (§210): the (idea_id, user_id) unique key is the control —
// insert wins, delete removes; no read-then-write race. Emoji changes are
// delete + insert (migration 20260922000000 grants no UPDATE).
//
// Visibility: published ideas are browse-safe; drafts are owner-only via the
// #121 app-explicit rule (RLS is the second layer, never the only one) —
// identical to getIdea's non-published → NOT_FOUND behaviour.
//
// idea_reactions is NOT in the generated Database type yet (type regeneration
// happens against a live DB), so the untyped SupabaseClient facade is used
// exactly like idea-people.service.ts; the SQL layer keeps RLS as the real
// boundary.

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { uuidSchema } from '@/lib/validation'

// Allowlisted reaction emoji for ideas. A fixed set means no arbitrary string
// can ever reach storage and keeps aggregate chips bounded (§381).
export const IDEA_REACTIONS = [
  '❤️',
  '👍',
  '🔥',
  '😂',
  '🎉',
  '🙌',
  '👀',
  '🤝',
] as const

export type IdeaReaction = (typeof IDEA_REACTIONS)[number]

export function isIdeaReaction(value: unknown): value is IdeaReaction {
  return (
    typeof value === 'string' &&
    (IDEA_REACTIONS as readonly string[]).includes(value)
  )
}

// ─── Schemas ────────────────────────────────────────────────

const ideaReactionEmojiSchema = z.enum(
  // `as const` array → non-empty tuple for z.enum.
  IDEA_REACTIONS as unknown as [string, ...string[]],
)

export const toggleIdeaReactionSchema = z
  .object({
    ideaId: uuidSchema,
    emoji: ideaReactionEmojiSchema,
  })
  .strict()

export type ToggleIdeaReactionInput = z.infer<typeof toggleIdeaReactionSchema>

export const listIdeaReactionsSchema = z
  .object({
    ideaId: uuidSchema,
  })
  .strict()

export type ListIdeaReactionsInput = z.infer<typeof listIdeaReactionsSchema>

// ─── Projections ────────────────────────────────────────────

export interface IdeaReactionRecord {
  ideaId: string
  userId: string
  emoji: string
  createdAt: string
}

/** Aggregated chip rendered next to an idea (mirrors ReactionSummary). */
export interface IdeaReactionSummary {
  emoji: IdeaReaction
  count: number
  /** Viewer reacted with this emoji — drives the pressed/active style. */
  mine: boolean
}

interface IdeaReactionRow {
  idea_id: string
  user_id: string
  emoji: string
  created_at: string
}

function toRecord(row: IdeaReactionRow): IdeaReactionRecord | null {
  if (!isIdeaReaction(row.emoji)) return null // unknown/legacy → drop
  return {
    ideaId: row.idea_id,
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  }
}

/** Most-reacted first, then canonical order so ordering never jitters. */
export function summarizeIdeaReactions(
  rows: readonly IdeaReactionRecord[],
  viewerId: string,
): IdeaReactionSummary[] {
  const counts = new Map<IdeaReaction, number>()
  const mine = new Set<IdeaReaction>()

  for (const row of rows) {
    if (!isIdeaReaction(row.emoji)) continue // unknown/legacy values dropped
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1)
    if (row.userId === viewerId) mine.add(row.emoji)
  }

  return [...counts.entries()]
    .map(([emoji, count]) => ({
      emoji,
      count,
      mine: mine.has(emoji),
    }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count
      return (
        IDEA_REACTIONS.indexOf(left.emoji) - IDEA_REACTIONS.indexOf(right.emoji)
      )
    })
}

// ─── Visibility gate (#121) ─────────────────────────────────

/**
 * The reaction surface must be behind the same visibility rule as getIdea: a
 * non-owner reading (or writing on) a non-published idea gets NOT_FOUND —
 * existence is never leaked. Throws, or returns nothing.
 */
async function assertIdeaReactionVisible(
  userId: string,
  ideaId: string,
): Promise<void> {
  const supabase =
    (await createServerSupabaseClient()) as unknown as SupabaseClient

  const { data, error } = await supabase
    .from('ideas')
    .select('owner_id, visibility')
    .eq('id', ideaId)
    .maybeSingle()

  if (error) {
    logger.error('Failed to load idea for reaction', {
      ideaId,
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load idea', {
      cause: error,
    })
  }

  const idea = (data ?? null) as { owner_id: string; visibility: string } | null
  if (!idea) throw AppError.notFound('Idea', ideaId)

  if (idea.owner_id !== userId && idea.visibility !== 'published') {
    throw AppError.notFound('Idea', ideaId)
  }
}

// ─── Service ────────────────────────────────────────────────

/** Toggle the viewer's single reaction on an idea. Returns the new state. */
export async function toggleIdeaReaction(
  userId: string,
  input: ToggleIdeaReactionInput,
): Promise<{ reacted: boolean }> {
  const parsed = toggleIdeaReactionSchema.parse(input)
  await assertIdeaReactionVisible(userId, parsed.ideaId)

  const supabase =
    (await createServerSupabaseClient()) as unknown as SupabaseClient
  const table = supabase.from('idea_reactions')

  // Replace-first: clear any existing reaction, then add if toggling on.
  const removed = await table
    .delete()
    .eq('idea_id', parsed.ideaId)
    .eq('user_id', userId)
  if (removed.error) {
    throw AppError.fromUnknown(removed.error, ErrorCodes.INTERNAL)
  }

  const { error } = await table.insert({
    idea_id: parsed.ideaId,
    user_id: userId,
    emoji: parsed.emoji,
  })

  if (error) {
    // §210 race: a concurrent toggle won the (idea_id, user_id) unique key.
    // The row exists — converge on "reacted" instead of surfacing an error
    // (23505 = unique_violation, per the migration's control comment).
    if (error.code !== '23505') {
      logger.error('toggleIdeaReaction insert failed', { error, userId })
      throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
    }
  }

  return { reacted: true }
}

/** Remove the viewer's reaction (toggle off). */
export async function removeIdeaReaction(
  userId: string,
  input: ToggleIdeaReactionInput,
): Promise<{ reacted: boolean }> {
  const parsed = toggleIdeaReactionSchema.parse(input)

  const supabase =
    (await createServerSupabaseClient()) as unknown as SupabaseClient

  const { error } = await supabase
    .from('idea_reactions')
    .delete()
    .eq('idea_id', parsed.ideaId)
    .eq('user_id', userId)

  if (error) {
    logger.error('removeIdeaReaction failed', { error, userId })
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
  }

  return { reacted: false }
}

/** Grouped read for one idea — one query, never a per-user round trip. */
export async function listIdeaReactions(
  userId: string,
  input: ListIdeaReactionsInput,
): Promise<IdeaReactionSummary[]> {
  const parsed = listIdeaReactionsSchema.parse(input)
  await assertIdeaReactionVisible(userId, parsed.ideaId)

  const supabase =
    (await createServerSupabaseClient()) as unknown as SupabaseClient

  const { data, error } = await supabase
    .from('idea_reactions')
    .select('idea_id, user_id, emoji, created_at')
    .eq('idea_id', parsed.ideaId)

  if (error) {
    logger.error('listIdeaReactions failed', { error, userId })
    throw AppError.fromUnknown(error, ErrorCodes.INTERNAL)
  }

  const rows = (data ?? [])
    .map((row) => toRecord(row as IdeaReactionRow))
    .filter((row): row is IdeaReactionRecord => row !== null)

  return summarizeIdeaReactions(rows, userId)
}
