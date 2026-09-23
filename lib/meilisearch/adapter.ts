// src/lib/meilisearch/adapter.ts — SEARCH ADAPTER (§339 row "Meilisearch").
// Meili-first profile search with the in-DB token-rank path as fallback.
// SAFETY EQUIVALENCE: Meili ranks candidates only — every hit id is re-read
// from public_search_profiles (RLS server client) then filterBlockedCandidates
// + rankResult run exactly as the in-DB path does. Never rank-then-filter;
// unverifiable blocks fail closed via the same AppError as searchProfiles.
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { filterBlockedCandidates } from '@/services/safety/safety.service'
import {
  toProfileSummaryDTO,
  type ProfileRow,
  type ProfileSummaryDTO,
} from '@/lib/dto'
import { rankResult } from '@/services/search/service'
import { getMeiliClient } from '@/lib/meilisearch/client'
import { PROFILE_MAX_HITS } from '@/lib/meilisearch/indexes'
import { profileIndexUid } from '@/lib/meilisearch/sync'

/** Meili-ranked ids, pre-block-filter. Exported for tests. */
export interface MeiliProfileHit {
  id: string
}
export const ADAPTER_ALGORITHM = 'meili-rank.v1'
/** Over-fetch factor: Meili returns ranked ids; block+rank filtering + re-read
 *  shrinks the set, so request more ids than the caller's limit. */
export const ADAPTER_OVERFETCH = 5

function buildIdsNotInFilter(ids: readonly string[]): string {
  return `id NOT IN [${ids.map((id) => JSON.stringify(id)).join(', ')}]`
}

/** Hit ids from the index; null = Meili unavailable/failed (caller falls back). */
export async function fetchMeiliCandidateIds(
  query: string,
  opts: { limit: number; excludedIds?: readonly string[] } = { limit: 20 },
): Promise<string[] | null> {
  const client = getMeiliClient()
  if (!client) return null
  const trimmed = query.trim()
  if (!trimmed) return []
  const filter =
    opts.excludedIds && opts.excludedIds.length > 0
      ? buildIdsNotInFilter(opts.excludedIds)
      : undefined
  try {
    const res = await client
      .index<MeiliProfileHit>(profileIndexUid())
      .search(trimmed, {
        limit: Math.min(
          Math.max(opts.limit * ADAPTER_OVERFETCH, opts.limit),
          PROFILE_MAX_HITS,
        ),
        ...(filter ? { filter } : {}),
      })
    const ids = (res.hits ?? [])
      .map((h) => h.id)
      .filter((id) => typeof id === 'string' && id)
    return [...new Set(ids)]
  } catch (e) {
    logger.warn('Meili search failed; falling back to in-DB path', {
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/**
 * Meili-first profile search. `available` reports whether ids came from the
 * index (true) or the adapter already degraded (false — caller MUST run the
 * in-DB path instead).
 */
export async function searchProfilesWithMeili(
  query: string,
  opts: {
    limit?: number
    viewerId?: string
    excludedIds?: readonly string[]
  } = {},
): Promise<{ available: boolean; items: ProfileSummaryDTO[] }> {
  const limitRaw = opts.limit ?? 20
  const limit = Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
  const ids = await fetchMeiliCandidateIds(query, {
    limit,
    excludedIds: opts.excludedIds,
  })
  if (ids === null) return { available: false, items: [] }
  if (ids.length === 0) return { available: true, items: [] }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await (
    supabase as unknown as {
      from: (t: 'public_search_profiles') => {
        select: (c: string) => {
          in: (
            col: string,
            ids: string[],
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  )
    .from('public_search_profiles')
    .select('id, full_name, role, bio, skills, avatar_url, last_active_at')
    .in('id', ids)
  if (error) {
    logger.error('Meili adapter: canonical re-read failed', {
      error: error.message,
    })
    return { available: false, items: [] }
  }
  const rows = (data ?? []) as unknown as ProfileRow[]
  // Same ordering contract as the in-DB path: eligible → token-rank → slice.
  // filterBlockedCandidates fails closed (AppError) — a Meili answer must never
  // be MORE permissive than the in-DB path.
  const eligible = opts.viewerId
    ? await filterBlockedCandidates(opts.viewerId, rows)
    : rows
  const normalized = query.trim().replace(/\s+/g, ' ')
  const items = eligible
    .map((row) => ({
      dto: toProfileSummaryDTO(row),
      score: rankResult(normalized, [
        row.full_name,
        row.role ?? '',
        row.bio ?? '',
        (row.skills ?? []).join(' '),
      ]),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.dto)
  return { available: true, items }
}
