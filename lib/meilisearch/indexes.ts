// src/lib/meilisearch/indexes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Meilisearch integration — INDEX SCHEMA (§339 row "Meilisearch": client, index
// schema, sync worker, search adapter, tests).
//
// The index is a PROJECTION of `public_search_profiles` — the canonical
// SQL-enforced eligibility view (visibility / onboarding / suspension). Search
// must never widen that set: whatever SQL says is browsable is exactly what may
// be indexed. Meilisearch is an accelerator over that view, never a second
// source of truth (§118 — never rank-then-filter; filter is authoritative).
//
// Settings are declarative data, so this module is PURE and unit-testable: the
// `applyIndexSettings` call in sync.ts is the only I/O.
// ─────────────────────────────────────────────────────────────────────────────

/** Indexes Connect owns. One uid per searchable entity, suffix-namespaced. */
export const MEILI_INDEXES = {
  profiles: 'profiles',
} as const

export type MeiliIndexName = (typeof MEILI_INDEXES)[keyof typeof MEILI_INDEXES]

/** Fully-qualified uid, so staging and production never share an index. */
export function indexUid(name: MeiliIndexName, prefix: string): string {
  const safePrefix = prefix.trim() || 'connect_'
  return `${safePrefix}${name}`
}

/**
 * Attributes Meilisearch may match on, in decreasing importance.
 *
 * `skills` outranks `bio`: skills are a structured, deliberate signal while bio
 * is free text, so a skill hit is a stronger relevance signal than prose that
 * happens to contain the word. `role` sits between them for the same reason.
 */
export const PROFILE_SEARCHABLE_ATTRIBUTES = [
  'full_name',
  'skills',
  'role',
  'bio',
] as const

/**
 * Attributes usable as FILTERS (exact match, no ranking).
 *
 * `id` is filterable so a viewer-scoped block/exclusion set can be applied as a
 * filter — the Meilisearch equivalent of SQL-side eligibility, which keeps
 * "never rank-then-filter" true on this path too (#169).
 *
 * Deliberately excludes `visibility`: the `public_search_profiles` view has
 * already applied that predicate in SQL, so the column is not projected here
 * and a filter on it would be dead config (and a temptation to re-decide
 * eligibility outside the canonical view).
 */
export const PROFILE_FILTERABLE_ATTRIBUTES = ['id', 'role', 'skills'] as const

/** Attributes usable in `sort` — `last_active_at` powers recency ordering. */
export const PROFILE_SORTABLE_ATTRIBUTES = ['last_active_at'] as const

/**
 * Relevance first, then the product's ordering preferences. `last_active_at:desc`
 * is appended so ties on relevance break toward the more active member — the
 * same tiebreak the in-DB path applies, so both paths rank alike.
 */
export const PROFILE_RANKING_RULES = [
  'words',
  'typo',
  'attribute',
  'proximity',
  'exactness',
  'last_active_at:desc',
] as const

/**
 * Typo tolerance is ON for names (typing a person's name wrong should still
 * find them) but capped: `minWordSizeForTypos` stays low enough for short names
 * while `disableOnWords` protects short query terms from becoming noise.
 */
export const PROFILE_TYPO_TOLERANCE = {
  enabled: true,
  minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
  disableOnAttributes: [] as string[],
} as const

/**
 * Hard cap on server-side search effort, in ms. Search must respect the §4
 * cache-hit SLO of p95 < 100ms, so Meilisearch is told to stop early rather
 * than let one pathological query consume the request budget.
 */
export const PROFILE_SEARCH_CUTOFF_MS = 80

/** Page size cap — mirrors `MAX_DB_RESULTS = 100` in the in-DB path. */
export const PROFILE_MAX_HITS = 100

/**
 * Declarative index settings, applied idempotently by the bootstrap step.
 * `settings` is Meilisearch's own `Settings` shape; keeping it as a plain
 * object (not an SDK type import) keeps this module pure and testable.
 */
export function profileIndexSettings() {
  return {
    searchableAttributes: [...PROFILE_SEARCHABLE_ATTRIBUTES],
    filterableAttributes: [...PROFILE_FILTERABLE_ATTRIBUTES],
    sortableAttributes: [...PROFILE_SORTABLE_ATTRIBUTES],
    rankingRules: [...PROFILE_RANKING_RULES],
    typoTolerance: {
      enabled: PROFILE_TYPO_TOLERANCE.enabled,
      minWordSizeForTypos: PROFILE_TYPO_TOLERANCE.minWordSizeForTypos,
      disableOnAttributes: [...PROFILE_TYPO_TOLERANCE.disableOnAttributes],
    },
    searchCutoffMs: PROFILE_SEARCH_CUTOFF_MS,
    pagination: { maxTotalHits: PROFILE_MAX_HITS },
  }
}
