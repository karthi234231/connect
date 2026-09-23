// src/services/matching/filters.schema.ts
import { z } from 'zod'
import { roleSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

/**
 * Match Filters Schema
 *
 * Validates filter options for the Discover feed.
 * All fields are optional – when omitted, the matching engine
 * applies default behavior (all roles, no skill filter, etc.).
 *
 * Business rules:
 * - `minScore` must be between 0 and 100 (inclusive)
 * - `role` must be a valid role enum
 * - `skill` is a free‑text string (exact match, not regex)
 * - `limit` controls how many results to return (1‑50)
 */
// S037 professional hard filters — deterministic, server-authoritative.
// These are hard candidate-set filters (AND semantics), applied BEFORE scoring;
// they never affect the score itself (ranking stays in the engine).
const daySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const workStyleSchema = z.enum(['structured', 'flexible', 'fast_iterate'])
const commitmentSchema = z.enum([
  'exploring',
  'nights_weekends',
  'part_time',
  'full_time',
])
const regionSchema = z.enum(['Africa', 'America', 'Asia', 'Europe', 'Oceania'])
const activeWithinSchema = z.enum(['7', '30', '90'])

export const matchFiltersSchema = z
  .object({
    role: roleSchema.optional(),
    skill: z
      .string()
      .min(1, { message: 'Skill filter must not be empty.' })
      .max(30, { message: 'Skill filter must be at most 30 characters.' })
      .transform((val) => val.toLowerCase().trim())
      .optional(),
    availabilityDay: daySchema.optional(),
    region: regionSchema.optional(),
    workStyle: workStyleSchema.optional(),
    commitmentLevel: commitmentSchema.optional(),
    /** Candidate last active within N days. String enum → URL-friendly. */
    activeWithinDays: activeWithinSchema.optional(),
    /** Internal ranking threshold — NOT a user-facing control (S037). */
    minScore: z
      .number()
      .int({ message: 'Score must be an integer.' })
      .min(0, { message: 'Minimum score must be at least 0.' })
      .max(100, { message: 'Minimum score must be at most 100.' })
      .default(55)
      .optional(),
    limit: z
      .number()
      .int({ message: 'Limit must be an integer.' })
      .min(1, { message: 'Limit must be at least 1.' })
      .max(50, { message: 'Limit must be at most 50.' })
      .default(10)
      .optional(),
  })
  .strict()

export type MatchFiltersInput = z.infer<typeof matchFiltersSchema>

// ─── S15 — SQL-boundary hard-filter conditions builder ──────────────────
// The Discover pool query gets the losslessly-translatable hard filters pushed
// into its WHERE BEFORE any bounded-pool cap (never `select first N → filter
// in JS`). Each condition mirrors the EXACT JS comparison in `matchesHardFilters`:
//
//   role              → eq           (identical value comparison)
//   workStyle         → eq           (identical value comparison)
//   commitmentLevel   → eq           (identical value comparison)
//   region            → like 'R/%'   (identical `timezone.startsWith('R/')`,
//                                     case-sensitive LIKE on canonical IANA tz)
//   activeWithinDays  → gte cutoff   (identical JS cutoff: now − N days)
//   availabilityDay   → cs '["d"]'   (jsonb containment `availability->days @>
//                                     '["d"]'`; stored days are the same
//                                     lowercase 3-letter enum the JS guard slices to)
//
// `skill` is deliberately NOT translated: the JS predicate is an exact
// case-insensitive membership test over `skills text[]` (`s.toLowerCase() ===
// filter`), which has no lossless stock PostgREST operator. Pushing a
// case-sensitive `contains` would silently drop differently-cased skills that
// `matchesHardFilters` accepts, so skill stays in the JS stage — which still
// runs BEFORE the bounded-pool cap. `minScore`/`limit` are ranking controls,
// not candidate-set filters, and are not pushed.
//
// `matchesHardFilters` remains the authoritative pure predicate (unit-tested,
// used by non-view call-sites and as the post-query net over whatever rows the
// boundary admitted). The WHERE conditions are an efficiency + order win, never
// a second source of truth — the JS net re-asserts the same comparisons.
export type PoolQueryCondition =
  | {
      column: 'role' | 'work_style' | 'commitment_level'
      operator: 'eq'
      value: string
    }
  | {
      column: 'timezone'
      operator: 'like'
      value: string
      /** The IANA prefix this LIKE was derived from (e.g. "Europe" → "Europe/%"). */
      regionPrefix: string
    }
  | {
      column: 'last_active_at'
      operator: 'gte'
      value: string
      /** ISO-8601 cutoff identical to `matchesHardFilters`' activeWithinDays cutoff. */
      cutoff: string
    }
  | {
      column: 'availability->days'
      operator: 'cs'
      value: string
      /** JSON array literal matching the stored lowercase 3-letter day enum. */
      day: string
    }

const DAYS_TO_MS = 24 * 60 * 60 * 1000

export function filtersToQueryConditions(
  filters: MatchFiltersInput,
): PoolQueryCondition[] {
  const conditions: PoolQueryCondition[] = []

  if (filters.role) {
    conditions.push({ column: 'role', operator: 'eq', value: filters.role })
  }

  if (filters.workStyle) {
    conditions.push({
      column: 'work_style',
      operator: 'eq',
      value: filters.workStyle,
    })
  }

  if (filters.commitmentLevel) {
    conditions.push({
      column: 'commitment_level',
      operator: 'eq',
      value: filters.commitmentLevel,
    })
  }

  if (filters.region) {
    conditions.push({
      column: 'timezone',
      operator: 'like',
      value: `${filters.region}/%`,
      regionPrefix: filters.region,
    })
  }

  if (filters.activeWithinDays) {
    // Same reference frame as matchesHardFilters (JS clock, not DB now()) so
    // the SQL gate and the JS net agree to the millisecond.
    const cutoff = new Date(
      Date.now() - Number(filters.activeWithinDays) * DAYS_TO_MS,
    ).toISOString()
    conditions.push({
      column: 'last_active_at',
      operator: 'gte',
      value: cutoff,
      cutoff,
    })
  }

  if (filters.availabilityDay) {
    conditions.push({
      column: 'availability->days',
      operator: 'cs',
      value: `["${filters.availabilityDay}"]`,
      day: filters.availabilityDay,
    })
  }

  return conditions
}

// ─── Hard-filter predicate (deterministic, explainable) ─────────────────

export function matchesHardFilters(
  candidate: {
    role: string
    skills: string[]
    availability: { days: string[] }
    timezone: string
    workStyle?: string | null
    commitmentLevel?: string | null
    lastActiveAt: string | null
  },
  filters: MatchFiltersInput,
): boolean {
  if (filters.role && candidate.role !== filters.role) return false
  if (
    filters.skill &&
    !candidate.skills.some((s) => s.toLowerCase() === filters.skill)
  )
    return false
  if (
    filters.availabilityDay &&
    !candidate.availability.days
      .map((d) => d.toLowerCase().slice(0, 3))
      .includes(filters.availabilityDay)
  )
    return false
  if (filters.region) {
    const tz = candidate.timezone || 'UTC'
    if (!tz.startsWith(`${filters.region}/`)) return false
  }
  if (filters.workStyle && candidate.workStyle !== filters.workStyle)
    return false
  if (
    filters.commitmentLevel &&
    candidate.commitmentLevel !== filters.commitmentLevel
  )
    return false
  if (filters.activeWithinDays) {
    if (!candidate.lastActiveAt) return false
    const cutoff =
      Date.now() - Number(filters.activeWithinDays) * 24 * 60 * 60 * 1000
    if (new Date(candidate.lastActiveAt).getTime() < cutoff) return false
  }
  return true
}

// ─── Sanitized version for internal use ─────────────────
export function sanitizeFilters(raw: unknown): MatchFiltersInput {
  const result = matchFiltersSchema.safeParse(raw)
  if (!result.success) {
    logger.warn('Invalid match filters provided', {
      errors: result.error.flatten().fieldErrors,
      // Redact raw input to avoid logging PII
      rawType: typeof raw,
    })
    // Return safe defaults with all optional fields explicitly undefined
    return {
      minScore: 55,
      limit: 10,
      skill: undefined,
      role: undefined,
    }
  }
  logger.debug('Match filters parsed', { filters: result.data })
  return result.data
}
