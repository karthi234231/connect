// src/lib/meilisearch/documents.ts
// ─────────────────────────────────────────────────────────────────────────────
// Meilisearch integration — DOCUMENT PROJECTION (§339 row "Meilisearch").
//
// A search index is a COPY of the data, so it is a second place PII can leak
// from. Two rules, mirroring src/lib/posthog/privacy.ts:
//
// 1. ALLOWLIST. A search document is built field-by-field from an explicit
//    list. `ProfileRow` has an index signature (`[key: string]: unknown`), so
//    a spread would silently index whatever a future column holds — including
//    an email. Never `...row`.
//
// 2. SEARCH FIELDS ONLY. The document carries exactly what the canonical
//    `public_search_profiles` projection exposes and what `toProfileSummaryDTO`
//    needs to render a card, nothing more. No contact details, no precise
//    location, no hidden identity.
//
// PURE — no SDK, no I/O — so it is fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────
import type { ProfileRow } from '@/lib/dto'

/** The exact shape stored in the profiles index. */
export interface ProfileSearchDocument {
  id: string
  full_name: string
  role: string | null
  bio: string | null
  skills: string[]
  avatar_url: string | null
  last_active_at: string | null
}

/**
 * Cap indexed bio length. Bios are free text and a search index is not an
 * archive: the first 500 chars carry the signal, and an unbounded field is a
 * cheap way to make an index huge and slow.
 */
export const MAX_INDEXED_BIO_CHARS = 500

/**
 * Cap indexed skills. Matches `ProfileSummaryDTO.topSkills` intent (a card
 * shows 3) but keeps a wider window for matching; unbounded arrays are a
 * payload amplifier.
 */
export const MAX_INDEXED_SKILLS = 20

function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function sanitizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue // never index non-strings
    const trimmed = entry.trim()
    if (trimmed) out.push(trimmed)
    if (out.length >= MAX_INDEXED_SKILLS) break
  }
  return out
}

/**
 * Project a `profiles` row into a search document.
 *
 * Returns `null` when the row cannot be indexed safely — no `id`, or no
 * `full_name`. A nameless document would be unreachable by search and would
 * only waste index space, and `toProfileSummaryDTO` requires a name to render
 * a result card.
 */
export function toProfileSearchDocument(
  row: ProfileRow | null | undefined,
): ProfileSearchDocument | null {
  if (!row || typeof row.id !== 'string' || !row.id) return null
  if (typeof row.full_name !== 'string' || !row.full_name.trim()) return null

  return {
    id: row.id,
    full_name: row.full_name.trim(),
    role: truncate(row.role, 100),
    bio: truncate(row.bio, MAX_INDEXED_BIO_CHARS),
    skills: sanitizeSkills(row.skills),
    // Only store an avatar that is a real http(s) URL: `avatar_url` feeds an
    // <img src>, and an indexed `javascript:` value would be stored XSS.
    avatar_url: isSafeImageUrl(row.avatar_url)
      ? (row.avatar_url as string)
      : null,
    last_active_at: truncate(row.last_active_at, 40),
  }
}

/** `true` only for absolute http(s) URLs — blocks `javascript:`/`data:` payloads. */
export function isSafeImageUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Project a batch, dropping unindexable rows and de-duplicating by id.
 *
 * De-duplication matters because Meilisearch matches on primary key, so a
 * duplicate id in one `addDocuments` payload is an ambiguity; last-write-wins
 * is fine but it should be deliberate rather than incidental.
 */
export function toProfileSearchDocuments(
  rows: readonly ProfileRow[],
): ProfileSearchDocument[] {
  const byId = new Map<string, ProfileSearchDocument>()
  for (const row of rows) {
    const doc = toProfileSearchDocument(row)
    if (doc) byId.set(doc.id, doc)
  }
  return [...byId.values()]
}

/** Primary key for the profiles index. */
export const PROFILE_PRIMARY_KEY = 'id'
