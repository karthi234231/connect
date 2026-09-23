// src/services/ideas/revisions.ts
// CORE-06 — Idea edit history: read seam + write-through revision creation.
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import type { Database } from '@/types/database'

export interface IdeaRevisionDTO {
  id: string
  ideaId: string
  revisionNumber: number
  editorId: string
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  teamNeeded: string[]
  tags: string[]
  visibility: string
  joinEnabled: boolean
  createdAt: string
}

interface IdeaRevisionRow {
  id: string
  idea_id: string
  revision_number: number
  editor_id: string
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  team_needed: string[] | null
  tags: string[] | null
  visibility: string
  join_enabled: boolean
  created_at: string
}

function toRevisionDTO(row: IdeaRevisionRow): IdeaRevisionDTO {
  return {
    id: row.id,
    ideaId: row.idea_id,
    revisionNumber: row.revision_number,
    editorId: row.editor_id,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    ask: row.ask,
    stage: row.stage,
    teamNeeded: row.team_needed ?? [],
    tags: row.tags ?? [],
    visibility: row.visibility,
    joinEnabled: row.join_enabled,
    createdAt: row.created_at,
  }
}

/**
 * Read all revisions for a given idea. Only the idea owner can read revisions
 * (enforced by RLS). Returns an empty array when no revisions exist.
 */
export async function getIdeaRevisions(
  userId: string,
  ideaId: string,
): Promise<IdeaRevisionDTO[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('idea_revisions')
    .select(
      'id, idea_id, revision_number, editor_id, title, problem, solution, ask, stage, team_needed, tags, visibility, join_enabled, created_at',
    )
    .eq('idea_id', ideaId)
    .order('revision_number', { ascending: false })

  if (error) {
    logger.error('Failed to fetch idea revisions', {
      ideaId,
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load idea revisions', {
      cause: error,
    })
  }

  return (data ?? []).map(toRevisionDTO)
}

/**
 * Create a new revision snapshot for an idea. Called by updateIdea on every
 * edit to preserve a full audit trail. The editor_id must match the authenticated
 * user (RLS-enforced on INSERT).
 */
export async function createIdeaRevision(
  userId: string,
  ideaId: string,
  snapshot: {
    title: string
    problem: string
    solution: string
    ask: string
    stage: string
    teamNeeded: string[]
    tags: string[]
    visibility: string
    joinEnabled: boolean
  },
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // `revision_number` is NOT NULL and unique per idea (migration
  // 20260921030000). Derive the next number from the current maximum so the
  // snapshot chain is contiguous; the unique (idea_id, revision_number)
  // constraint makes a concurrent double-write fail loudly rather than corrupt
  // the history.
  const { data: latest, error: latestError } = await supabase
    .from('idea_revisions')
    .select('revision_number')
    .eq('idea_id', ideaId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    logger.error('Failed to read latest idea revision number', {
      ideaId,
      userId,
      error: latestError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to record idea revision', {
      cause: latestError,
    })
  }

  const revisionNumber = (latest?.revision_number ?? 0) + 1
  const { error } = await supabase.from('idea_revisions').insert({
    idea_id: ideaId,
    revision_number: revisionNumber,
    editor_id: userId,
    title: snapshot.title,
    problem: snapshot.problem,
    solution: snapshot.solution,
    ask: snapshot.ask,
    stage: snapshot.stage as Database['public']['Enums']['idea_stage'],
    team_needed: snapshot.teamNeeded,
    tags: snapshot.tags,
    visibility:
      snapshot.visibility as Database['public']['Enums']['idea_visibility'],
    join_enabled: snapshot.joinEnabled,
  })

  if (error) {
    logger.error('Failed to create idea revision', {
      ideaId,
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to record idea revision', {
      cause: error,
    })
  }
}
