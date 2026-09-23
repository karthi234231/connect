// src/services/search/service.ts
// #187 — search results carry algorithm version for debugging ranking changes

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { filterBlockedCandidates } from '@/services/safety/safety.service'

/** Minimal structural type for Supabase query chains on public read-model views
 *  that aren't surfaced by the generated `Database` type. */
type LooseQueryResult = {
  data: unknown
  error: { message: string; code?: string } | null
}
type LooseQuery = PromiseLike<LooseQueryResult> & {
  select: (columns: string) => LooseQuery
  or: (filters: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  limit: (count: number) => LooseQuery
}
type LooseTable = {
  from: (table: string) => LooseQuery
}
import {
  toProfileSummaryDTO,
  type ProfileSummaryDTO,
  type ProfileRow,
} from '@/lib/dto'
import {
  toEventSummaryDTO,
  type EventSummaryDTO,
  type EventRow,
} from '@/lib/dto-events'

/** #187 — metadata about the search/ranking algorithm used */
export interface SearchAlgorithmMeta {
  algorithm: string
  algorithmVersion: string
  generatedAt: string
}

/** #187 — search result with algorithm metadata */
export interface SearchResults<T> {
  items: T[]
  algorithm: SearchAlgorithmMeta
}

/** Current search algorithm version — bump when ranking logic changes */
export const SEARCH_ALGORITHM_VERSION = 'token-rank.v1'

export interface SearchOptions {
  limit?: number
  /**
   * #169 — viewer-scoped safety. When set, candidates blocked in either
   * direction are excluded BEFORE token ranking (never rank-then-filter).
   * Guest searches (no viewer) read the public pool without block filtering.
   */
  viewerId?: string
}

const MAX_SEARCH_LENGTH = 100
const MAX_DB_RESULTS = 100

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH)
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (character) => `\\${character}`)
}

/** #187 — build algorithm metadata for search results */
function buildAlgorithmMeta(): SearchAlgorithmMeta {
  return {
    algorithm: 'token-rank',
    algorithmVersion: SEARCH_ALGORITHM_VERSION,
    generatedAt: new Date().toISOString(),
  }
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 20
  }

  return Math.min(Math.max(Math.trunc(value), 1), 50)
}

// ─── Pure ranking ──────────────────────────────────────────

// #117 — Unicode-aware tokenization: NFKC folds compatibility forms
// (full-width, ligatures), lowercase is locale-safe via toLocaleLowerCase,
// and the split keeps letters/digits from ANY script (\p{L}\p{N} with the u
// flag) so accented and non-Latin names tokenize consistently.
//
// #118 — LIMITATION: ranking is currently application-side over ILIKE results.
// At scale this should be replaced with PostgreSQL FTS / pg_trgm / generated
// tsvector columns with GIN indexes, so the DB returns pre-ranked results.
// The current approach is acceptable for small-to-medium result sets but will
// not scale to large catalogues. The read-model views (public_search_profiles,
// public_ideas, public_events) provide a clean boundary for this migration.
export function tokenize(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .filter(Boolean)
}

export function rankResult(query: string, fields: string[]): number {
  const normalizedQuery = query.normalize('NFKC').trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return 0
  }

  const queryTokens = tokenize(normalizedQuery)

  if (queryTokens.length === 0) {
    return 0
  }

  if (fields.some((field) => field.trim().toLowerCase() === normalizedQuery)) {
    return 1
  }

  if (fields.some((field) => field.toLowerCase().includes(normalizedQuery))) {
    return 0.85
  }

  const candidateTokens = new Set(tokenize(fields.join(' ')))

  let hits = 0

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      hits += 1
    }
  }

  return hits / queryTokens.length
}

// ─── Profiles ──────────────────────────────────────────────

export async function searchProfiles(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResults<ProfileSummaryDTO>> {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return {
      items: [],
      algorithm: buildAlgorithmMeta(),
    }
  }

  const limit = normalizeLimit(options.limit)

  // Meili-first: when the index is configured and reachable, candidates come
  // from Meili (typo-tolerant, ranked) and are re-validated against the
  // canonical view + block list inside the adapter. On ANY unavailability the
  // adapter reports `available: false` and the in-DB path below runs instead —
  // search can never be worse than today when Meili is down or unconfigured.
  try {
    const { searchProfilesWithMeili, ADAPTER_ALGORITHM } =
      await import('@/lib/meilisearch/adapter')
    const meili = await searchProfilesWithMeili(normalizedQuery, {
      limit,
      viewerId: options.viewerId,
    })
    if (meili.available) {
      return {
        items: meili.items,
        algorithm: {
          algorithm: 'meili-rank',
          algorithmVersion: ADAPTER_ALGORITHM,
          generatedAt: new Date().toISOString(),
        },
      }
    }
  } catch {
    // Adapter never throws by contract, but a failed dynamic import (or a
    // future regression) must degrade to in-DB, never to a 500.
  }

  const searchPattern = `%${escapeIlike(normalizedQuery)}%`

  // HOST-AUTH-04 / HOST-PRIV-02: read the canonical public-search projection
  // view (visibility/onboarding/suspension eligibility enforced in SQL, not
  // here) through the RLS-respecting server client. Never the admin client.
  const supabase = await createServerSupabaseClient()

  const { data, error } = await (supabase as unknown as LooseTable)
    .from('public_search_profiles')
    .select('id, full_name, role, bio, skills, avatar_url, last_active_at')
    .or(`full_name.ilike.${searchPattern},bio.ilike.${searchPattern}`)
    .limit(MAX_DB_RESULTS)

  if (error) {
    logger.error('Profile search failed', {
      query: normalizedQuery,
      error: error.message,
    })

    throw error
  }

  const rows = (data ?? []) as unknown as ProfileRow[]

  // #169 — never rank and then filter blocked users. Suspected eligibility
  // (visibility/onboarding/suspension) is enforced in SQL by the public view;
  // block filtering happens here, before token ranking and the limit slice.
  const eligibleRows = options.viewerId
    ? await filterBlockedCandidates(options.viewerId, rows)
    : rows

  const items = eligibleRows
    .map((row) => ({
      dto: toProfileSummaryDTO(row),
      score: rankResult(normalizedQuery, [
        row.full_name,
        row.role ?? '',
        row.bio ?? '',
        (row.skills ?? []).join(' '),
      ]),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.dto)

  return {
    items,
    algorithm: buildAlgorithmMeta(),
  }
}

// ─── Ideas ─────────────────────────────────────────────────

export interface IdeaCardRow {
  id: string
  title: string
  problem?: string | null
  ask?: string | null
  stage?: string | null
  team_needed?: string[] | null
  tags?: string[] | null
  join_enabled?: boolean | null
  validation_count?: number | null
}

export function toIdeaCardDTO(row: IdeaCardRow) {
  return {
    id: row.id,
    title: row.title,
    problem: row.problem ?? '',
    ask: row.ask ?? '',
    stage: row.stage ?? 'idea',
    teamNeeded: row.team_needed ?? [],
    tags: row.tags ?? [],
    joinEnabled: Boolean(row.join_enabled),
    validationCount: row.validation_count ?? 0,
  }
}

export async function searchIdeas(
  query: string,
  options: SearchOptions = {},
): Promise<ReturnType<typeof toIdeaCardDTO>[]> {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return []
  }

  const limit = normalizeLimit(options.limit)

  const searchPattern = `%${escapeIlike(normalizedQuery)}%`

  const supabase = await createServerSupabaseClient()

  const { data, error } = await (supabase as unknown as LooseTable)
    .from('public_ideas')
    .select(
      'id, title, problem, ask, stage, team_needed, tags, join_enabled, validation_count',
    )
    .or(
      `title.ilike.${searchPattern},problem.ilike.${searchPattern},ask.ilike.${searchPattern}`,
    )
    .limit(MAX_DB_RESULTS)

  if (error) {
    logger.error('Idea search failed', {
      query: normalizedQuery,
      error: error.message,
    })

    throw error
  }

  const rows = (data ?? []) as unknown as IdeaCardRow[]

  return rows
    .map((row) => ({
      dto: toIdeaCardDTO(row),
      score: rankResult(normalizedQuery, [
        row.title,
        row.problem ?? '',
        row.ask ?? '',
        (row.tags ?? []).join(' '),
      ]),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.dto)
}

// ─── Events ────────────────────────────────────────────────

export async function searchEvents(
  query: string,
  options: SearchOptions = {},
): Promise<EventSummaryDTO[]> {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return []
  }

  const limit = normalizeLimit(options.limit)

  const searchPattern = `%${escapeIlike(normalizedQuery)}%`

  const supabase = await createServerSupabaseClient()

  const { data, error } = await (supabase as unknown as LooseTable)
    .from('public_events')
    .select(
      'id, title, description, type, format, location_or_link, starts_at, duration_minutes, capacity, tags',
    )
    .or(
      `title.ilike.${searchPattern},description.ilike.${searchPattern},location_or_link.ilike.${searchPattern}`,
    )
    .limit(MAX_DB_RESULTS)

  if (error) {
    logger.error('Event search failed', {
      query: normalizedQuery,
      error: error.message,
    })

    throw error
  }

  const rows = (data ?? []) as unknown as EventRow[]

  return rows
    .map((row) => ({
      dto: toEventSummaryDTO(row),
      score: rankResult(normalizedQuery, [
        row.title,
        row.description ?? '',
        row.location_or_link ?? '',
        (row.tags ?? []).join(' '),
      ]),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.dto)
}
