// src/services/discover/candidates.service.ts
// S039 — Single server owner of the Discover candidate read path.
// fetch batch → per-user cache → DTO; no client scoring authority.
import { randomUUID } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { redis } from '@/lib/redis'
import { loadWeights, getTopCandidates } from '@/services/matching/engine'
import {
  filtersToQueryConditions,
  matchesHardFilters,
  type MatchFiltersInput,
  type PoolQueryCondition,
} from '@/services/matching/filters.schema'
import { filterBlockedCandidates } from '@/services/safety/safety.service'
import { getProfile } from '@/services/profiles/service'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import type { Profile } from '@/services/profiles/mappers'
import type {
  ProfileForMatching,
  ScoreBreakdown,
} from '@/services/matching/compatibility'
import { SCORE_VERSION } from '@/services/matching/compatibility'
import type { CandidateScore } from '@/services/matching/engine'

export const DISCOVER_BATCH_LIMIT = 10
export const DISCOVER_POOL_CAP = 100

export interface DiscoverCandidateDTO extends CandidateScore {
  profile: Profile
  // ── S17 — server-authored recommendation snapshot (17A-signed) ──
  // Every candidate in a batch carries its own signed snapshot binding
  // { viewerId, candidateId, score, scoreVersion, epoch, expiresAt }. The
  // browser echoes `recommendationId + clientIntentId` on swipe; the server
  // verifies signature → owner → candidate → epoch → expiry → version and
  // never trusts a client-supplied score. Snapshots arrive INSIDE the items
  // (not as a sibling array) so a snapshot can never desync from its candidate.
  recommendation: RecommendationSnapshotWire
}

/**
 * S17/17A — server-authored recommendation snapshot (wire form).
 *
 * - `recommendationId` — opaque per-candidate token: viewers echo it on swipe.
 * - `candidateId` — bound candidate (swipe must resolve to the same one).
 * - `score`/`scoreVersion` — server-computed values, signed; client echoes them
 *   but the HMAC is the authority, never the echoed numbers.
 * - `factors` — explainable per-dimension contributions from the engine's
 *   `ScoreBreakdown` (rounded %), rendered — never invented — by the client.
 * - `epoch` — discover epoch captured at batch time; a swipe whose epoch no
 *   longer matches the cursor era is rejected as `RECOMMENDATION_STALE` (the
 *   candidate pool changed underneath the card: swipe/block/weight change).
 * - `expiresAt` — absolute validity deadline; past it → `RECOMMENDATION_EXPIRED`.
 */
export interface RecommendationSnapshotWire {
  recommendationId: string
  candidateId: string
  score: number
  factors: Record<string, number>
  scoreVersion: string
  epoch: string
  expiresAt: string
}

export interface DiscoverBatch {
  items: DiscoverCandidateDTO[]
  /** Opaque cursor for the next batch; null = exhausted. */
  nextCursorToken: string | null
  version: string
}

// ── Cursor token (opaque, offset-based over a deterministic ranked list) ──
export function encodeCursorToken(
  userId: string,
  offset: number,
  version: string,
): string {
  return Buffer.from(
    JSON.stringify({ u: userId, o: offset, v: version }),
    'utf8',
  ).toString('base64url')
}

export function decodeCursorToken(
  token: string,
): { userId: string; offset: number; version: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    ) as { u?: unknown; o?: unknown; v?: unknown }
    if (
      typeof parsed.u !== 'string' ||
      typeof parsed.o !== 'number' ||
      !Number.isInteger(parsed.o) ||
      parsed.o < 0 ||
      typeof parsed.v !== 'string'
    ) {
      return null
    }
    return { userId: parsed.u, offset: parsed.o, version: parsed.v }
  } catch {
    return null
  }
}

// ── S17/17A — HMAC-signed recommendation snapshots ──
// Sessions 17 + 17A. The snapshot is minted server-side at batch time and
// verified server-side at swipe time. HMAC secret: the existing 32-char
// `CSRF_SECRET` (no new env key required; snapshot auth and CSRF share the
// proven secret). Payload is base64url `{…}.sig` — one opaque string the
// browser echoes as `recommendationId`.
import { createHmac } from 'node:crypto'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/security'

/** Snapshot lifetime from mint — cards are freshly computed; 30 min is plenty. */
export const RECOMMENDATION_SNAPSHOT_TTL_MS = 30 * 60 * 1000

interface SnapshotPayload {
  v: number
  u: string
  c: string
  s: number
  f: Record<string, number>
  sv: string
  e: string
  x: string
}

function snapshotSecret(): string {
  // CSRF_SECRET is env-validated ≥32 chars (lib/env.ts). Fail LOUD if it is
  // missing rather than signing with a fallback (17A: never forge validity).
  const secret = env.CSRF_SECRET as string | undefined
  if (!secret) {
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Recommendation signing unavailable',
    )
  }
  return secret
}

function signSnapshot(payload: SnapshotPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  const sig = createHmac('sha256', snapshotSecret())
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

function openSnapshot(recommendationId: string): SnapshotPayload | null {
  const dot = recommendationId.lastIndexOf('.')
  if (dot <= 0) return null
  const body = recommendationId.slice(0, dot)
  const sig = recommendationId.slice(dot + 1)
  let expected: string
  try {
    expected = createHmac('sha256', snapshotSecret())
      .update(body)
      .digest('base64url')
  } catch {
    return null
  }
  if (sig.length !== expected.length) return null
  try {
    // `safeCompare` hashes both sides before the constant-time compare, so a
    // truncated/forged signature returns false rather than throwing inside
    // timingSafeEqual (the length check above is the fast reject, this is the
    // authoritative compare).
    if (!safeCompare(sig, expected)) {
      return null
    }
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Record<string, unknown>
    if (
      parsed.v !== 1 ||
      typeof parsed.u !== 'string' ||
      typeof parsed.c !== 'string' ||
      typeof parsed.s !== 'number' ||
      typeof parsed.f !== 'object' ||
      parsed.f === null ||
      typeof parsed.sv !== 'string' ||
      typeof parsed.e !== 'string' ||
      typeof parsed.x !== 'string'
    ) {
      return null
    }
    return parsed as unknown as SnapshotPayload
  } catch {
    return null
  }
}

// ── Per-user epoch: bumped on mutations (swipe) → old cursors orphan. ──
export function discoverEpochKey(userId: string): string {
  return `recs:epoch:${userId}`
}

export async function getDiscoverEpoch(userId: string): Promise<string> {
  try {
    const epoch = await redis.get(discoverEpochKey(userId))
    return typeof epoch === 'string' ? epoch : '0'
  } catch (error: unknown) {
    // Redis failure: return an unmatchable epoch instead of "0" (#48) — an
    // epoch-0 cursor from before the failure must never be resumed against a
    // feed we can no longer verify. A random epoch forces a cursor-reset on
    // the next page request (fail-safe, not fail-open).
    logger.warn('Discover epoch read failed; using unmatchable epoch', {
      userId,
      error,
    })
    return `err-${randomUUID()}`
  }
}

export async function bumpDiscoverEpoch(userId: string): Promise<void> {
  try {
    // Atomic increment (INCR), then refresh the 24h TTL. A read-modify-write
    // here could lose a bump when two mutations race, resurrecting a cursor
    // epoch the client still holds.
    await redis.incr(discoverEpochKey(userId))
    await redis.expire(discoverEpochKey(userId), 86400)
  } catch (error: unknown) {
    logger.warn('Discover epoch bump failed', { userId, error })
  }
}

// ── S17+20 — snapshot idempotency (clientIntentId + single-use) ──
// Sessions 17 (clientIntentId) + 20 (no intermediate state) + 17A (consumed).
// Two layers:
//   1. `clientIntentId` (S17): the browser sends a UUID per swipe gesture.
//      Retries of the SAME gesture replay the same intent id. Served results are
//      memoized in Redis with a 10-minute TTL, so a network retry returns the
//      IDENTICAL result (matchCreated/matchId) instead of performing the
//      mutation twice. Memoization is scoped per (user, intent) and never
//      trusted for identity — the snapshot HMAC + ownership gates still run.
//   2. Single-use snapshots (S17A-consumed + S20 atomicity): a verified
//      snapshot is claimed (SET NX) BEFORE the swipe transaction commits, so a
//      second replay — even racing the first — observes the consumed marker and
//      gets `RECOMMENDATION_CONSUMED`. Claim + release bracket the mutation: a
//      failed swipe releases the claim so the viewer can retry with the SAME
//      snapshot (transients must not burn the card).
// Redis down for either check ⇒ allow the flow (fail-open): the DB upsert +
// epoch bump remain the durable safety nets, and rejecting all swipes because
// a cache node is sick would be a bigger outage than a double-counted retry.
export interface SwipeIntentResult {
  matchCreated: boolean
  matchId?: string
  /**
   * P0-10 — server-authoritative quota remainder at memo time. A replayed
   * intent re-serves the SAME remainder (byte-identical outcome), never a
   * re-derived or client-computed number.
   */
  quotaRemaining: number | null
}

const SWIPE_INTENT_TTL_S = 600

function swipeIntentKey(userId: string, clientIntentId: string): string {
  return `swipe:intent:${userId}:${clientIntentId}`
}

export async function getSwipeIntentResult(
  userId: string,
  clientIntentId: string,
): Promise<SwipeIntentResult | null> {
  const normalized = clientIntentId.trim()
  if (!normalized) return null
  try {
    const raw = await redis.get(swipeIntentKey(userId, normalized))
    if (typeof raw !== 'string') return null
    const parsed = JSON.parse(raw) as {
      matchCreated?: unknown
      matchId?: unknown
      quotaRemaining?: unknown
    }
    if (typeof parsed.matchCreated !== 'boolean') return null
    if (
      parsed.matchId !== undefined &&
      parsed.matchId !== null &&
      typeof parsed.matchId !== 'string'
    ) {
      return null
    }
    // Pre-quota memos carry no remainder: normalize to null explicitly.
    const quotaRemaining =
      typeof parsed.quotaRemaining === 'number' &&
      Number.isInteger(parsed.quotaRemaining) &&
      parsed.quotaRemaining >= 0 &&
      parsed.quotaRemaining <= 10
        ? parsed.quotaRemaining
        : null
    return {
      matchCreated: parsed.matchCreated,
      ...(typeof parsed.matchId === 'string'
        ? { matchId: parsed.matchId }
        : {}),
      quotaRemaining,
    }
  } catch {
    return null
  }
}

export async function setSwipeIntentResult(
  userId: string,
  clientIntentId: string,
  result: SwipeIntentResult,
): Promise<void> {
  const normalized = clientIntentId.trim()
  if (!normalized) return
  try {
    await redis.set(
      swipeIntentKey(userId, normalized),
      JSON.stringify(result),
      {
        ex: SWIPE_INTENT_TTL_S,
      },
    )
  } catch (error: unknown) {
    logger.warn('Swipe intent memoization failed', { userId, error })
  }
}

function snapshotConsumeKey(
  userId: string,
  candidateId: string,
  epoch: string,
): string {
  return `recs:consumed:${userId}:${candidateId}:${epoch}`
}

async function isSnapshotConsumed(key: string): Promise<boolean> {
  try {
    const value = await redis.get(key)
    return value !== null
  } catch {
    // Fail-open (see header): the epoch + DB gates below still apply.
    return false
  }
}

async function claimSnapshot(key: string): Promise<boolean> {
  try {
    // SET NX: only the first claimant wins; racing replays see the marker.
    const result = await redis.set(key, '1', { ex: 3600, nx: true })
    return result === 'OK'
  } catch {
    // Fail-open (see header): worst case the DB upsert absorbs the replay.
    return true
  }
}

async function releaseSnapshotClaim(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch {
    // Non-fatal: a stuck marker only over-rejects one card, and it expires.
  }
}

// ── S17 — recommendation snapshot verifier (swipe path) ──
// Sessions 17 + 17A. The single authority for "is this recommendationId a
// live, server-issued, first-use snapshot for THIS viewer + candidate". Checks
// run in spec order and map 1:1 to the error-contract codes:
//   signature/HMAC → RECOMMENDATION_INVALID (forged or unparseable)
//   owner mismatch → RECOMMENDATION_INVALID (never replayable by another user)
//   candidate mismatch → RECOMMENDATION_INVALID (snapshot bound to its candidate)
//   consumed (already swiped this epoch) → RECOMMENDATION_CONSUMED
//   stale epoch (pool changed since mint) → RECOMMENDATION_STALE
//   expired → RECOMMENDATION_EXPIRED
//   score-version mismatch → RECOMMENDATION_VERSION_MISMATCH
// On success the snapshot's authoritative fields are returned; the caller MUST
// use `score` from here — never any client-echoed number.
export interface VerifiedRecommendation {
  candidateId: string
  score: number
  factors: Record<string, number>
  scoreVersion: string
  epoch: string
  expiresAt: string
}

export async function verifyRecommendationSnapshot(
  userId: string,
  input: { recommendationId: string; candidateId: string },
): Promise<VerifiedRecommendation> {
  const normalizedCandidate = input.candidateId.trim()
  const payload = openSnapshot(input.recommendationId)

  if (!payload) {
    // Forged, truncated, or otherwise ill-formed recommendation id.
    throw new AppError(
      ErrorCodes.RECOMMENDATION_INVALID,
      'This recommendation is invalid. Refresh discover to get a fresh one.',
    )
  }

  if (payload.u !== userId) {
    logger.warn('Recommendation snapshot owner mismatch', { userId })
    throw new AppError(
      ErrorCodes.RECOMMENDATION_INVALID,
      'This recommendation is invalid. Refresh discover to get a fresh one.',
    )
  }

  if (payload.c !== normalizedCandidate) {
    logger.warn('Recommendation snapshot candidate mismatch', {
      userId,
      normalizedCandidate,
    })
    throw new AppError(
      ErrorCodes.RECOMMENDATION_INVALID,
      'This recommendation does not match the candidate. Refresh discover.',
    )
  }

  // S17+20 — consume check FIRST among the server-owned gates: a replay of a
  // snapshot the viewer already swiped → RECOMMENDATION_CONSUMED.
  const key = snapshotConsumeKey(userId, normalizedCandidate, payload.e)
  const already = await isSnapshotConsumed(key)
  if (already) {
    logger.info('Recommendation snapshot replay rejected', {
      userId,
      normalizedCandidate,
    })
    throw new AppError(
      ErrorCodes.RECOMMENDATION_CONSUMED,
      'This recommendation was already used. Refresh discover for new picks.',
    )
  }

  // Stale epoch: a bump since mint means the pool changed under this card.
  const currentEpoch = await getDiscoverEpoch(userId)
  if (currentEpoch !== payload.e) {
    logger.info('Recommendation snapshot stale epoch', {
      userId,
      mintedEpoch: payload.e,
      currentEpoch,
    })
    throw new AppError(
      ErrorCodes.RECOMMENDATION_STALE,
      'This recommendation is stale. Refresh discover for new picks.',
    )
  }

  // Expiry: absolute deadline from mint.
  const expiresTime = Date.parse(payload.x)
  if (!Number.isFinite(expiresTime) || Date.now() > expiresTime) {
    throw new AppError(
      ErrorCodes.RECOMMENDATION_EXPIRED,
      'This recommendation expired. Refresh discover to get a fresh one.',
    )
  }

  // Score-version drift: the weights/formula changed since the card rendered.
  if (payload.sv !== SCORE_VERSION) {
    throw new AppError(
      ErrorCodes.RECOMMENDATION_VERSION_MISMATCH,
      'Scoring changed since this recommendation was made. Refresh discover.',
    )
  }

  if (!Number.isFinite(payload.s)) {
    throw new AppError(
      ErrorCodes.RECOMMENDATION_INVALID,
      'This recommendation is invalid. Refresh discover to get a fresh one.',
    )
  }

  return {
    candidateId: payload.c,
    score: payload.s,
    factors: payload.f,
    scoreVersion: payload.sv,
    epoch: payload.e,
    expiresAt: payload.x,
  }
}

/**
 * Mint one S17/17A snapshot for a ranked candidate. The HMAC binds
 * { viewer, candidate, score, version, epoch, expiry } — the swipe path
 * re-verifies every field; echoed scores are never trusted.
 */
export function mintRecommendationSnapshot(
  viewerId: string,
  candidate: CandidateScore,
  epoch: string,
  expiresAt: string,
): RecommendationSnapshotWire {
  const factors: Record<string, number> = {}
  const breakdown = candidate.breakdown as Partial<ScoreBreakdown>
  for (const key of [
    'skill',
    'intent',
    'role',
    'availability',
    'activity',
    'timezone',
    'diversity',
  ] as const) {
    const raw = breakdown[key]
    factors[key] =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
  }
  const score = Math.round(candidate.score)
  const recommendationId = signSnapshot({
    v: 1,
    u: viewerId,
    c: candidate.candidateId,
    s: score,
    f: factors,
    sv: SCORE_VERSION,
    e: epoch,
    x: expiresAt,
  })
  return {
    recommendationId,
    candidateId: candidate.candidateId,
    score,
    factors,
    scoreVersion: SCORE_VERSION,
    epoch,
    expiresAt,
  }
}

// S17A + S20 — claim/release the snapshot's single-use marker. The canonical
// production entry (performSwipeAction) imports these from here; the
// *ForTest suffix marks the seam as also safe for unit tests to call.
export async function claimSnapshotForSwipe(
  userId: string,
  verified: VerifiedRecommendation,
): Promise<boolean> {
  return claimSnapshot(
    snapshotConsumeKey(userId, verified.candidateId, verified.epoch),
  )
}

/**
 * Release a snapshot claim (swipe-failure path). Exported alongside the claim
 * (see above) so production and tests share one seam.
 */
export async function releaseSnapshotForSwipe(
  userId: string,
  verified: VerifiedRecommendation,
): Promise<void> {
  await releaseSnapshotClaim(
    snapshotConsumeKey(userId, verified.candidateId, verified.epoch),
  )
}

// HOST-DB-02 — persist computed compatibility scores into server-owned
// recommendation_scores via the admin (service-role) client. The perform_swipe
// RPC derives the score from this table instead of trusting a client-supplied
// value. Persistence is best-effort on the discover read path: if the admin
// client is unavailable or the write fails, scoring still succeeds and the RPC
// falls back to the 0 default.
async function persistRecommendationScores(
  userId: string,
  scores: Array<{ candidateId: string; score: number }>,
): Promise<void> {
  if (scores.length === 0) return

  const admin = getAdminSupabaseClient()

  if (!admin) {
    logger.warn('Admin client unavailable; skipping score persistence', {
      userId,
    })
    return
  }

  try {
    const rows = scores.map((s) => ({
      user_id: userId,
      candidate_id: s.candidateId,
      score: Math.min(100, Math.max(0, s.score)),
    }))

    const { error } = await admin
      .from('recommendation_scores')
      .upsert(rows, { onConflict: 'user_id,candidate_id' })

    if (error) {
      logger.warn('Failed to persist recommendation scores', {
        userId,
        error: error.message,
      })
    }
  } catch (error: unknown) {
    logger.warn('Recommendation score persistence failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// ── #168 ── Dismissed/interacted candidates are hard-ineligible ──────────
// A candidate the user already swiped (any recommendation action) or already
// matched with must never consume the discovery pool cap or the ranking
// budget. Excluded at the DB boundary (`.not("id","in",…)` on the pool query),
// not afterwards in JavaScript. Reads go through the same `db` client the pool
// query uses: the RLS-respecting server client can read the actor's own
// recommendations/matches rows, and the admin client bypasses RLS for the
// actor's own scoped lookups.
type LooseQuery = PromiseLike<{
  data: unknown
  error: unknown
}> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  or: (filters: string) => LooseQuery
}

type DismissedSource = {
  from: (table: string) => LooseQuery
}

async function fetchDismissedCandidateIds(
  db: DismissedSource,
  userId: string,
): Promise<Set<string>> {
  const dismissed = new Set<string>()

  const [recommendations, matches] = await Promise.all([
    db.from('recommendations').select('candidate_id').eq('user_id', userId),
    db
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
  ])

  for (const rec of (recommendations.data ?? []) as Array<{
    candidate_id?: unknown
  }>) {
    if (typeof rec.candidate_id === 'string') dismissed.add(rec.candidate_id)
  }

  for (const match of (matches.data ?? []) as Array<{
    user1_id?: unknown
    user2_id?: unknown
  }>) {
    if (typeof match.user1_id === 'string') dismissed.add(match.user1_id)
    if (typeof match.user2_id === 'string') dismissed.add(match.user2_id)
  }

  // Never exclude the actor themselves (mirrors the pool's .neq("id", userId)).
  dismissed.delete(userId)

  return dismissed
}

// ── Row → profile helpers (single owner; page delegates here) ────────────
export type PublicProfileRow = {
  id: string | null
  full_name: string | null
  avatar_url: string | null
  role:
    | 'other'
    | 'founder'
    | 'engineer'
    | 'designer'
    | 'product'
    | 'growth'
    | 'operations'
    | 'data_ml'
    | null
  bio: string | null
  skills: string[]
  availability: unknown
  timezone: string | null
  looking_for: unknown
  commitment_level:
    'exploring' | 'nights_weekends' | 'part_time' | 'full_time' | null
  work_style: 'structured' | 'flexible' | 'fast_iterate' | null
  visibility: 'public' | 'recruiting' | 'private' | 'stealth' | null
  last_active_at: string | null
  created_at: string | null
  updated_at: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function parseAvailability(value: unknown): Profile['availability'] {
  if (!isRecord(value)) {
    // #50: never fabricate 09:00-17:00 — absent hours stay absent.
    return { days: [], hours: null }
  }
  const hours = isRecord(value.hours) ? value.hours : {}
  return {
    days: toStringArray(value.days),
    hours: {
      start: typeof hours.start === 'string' ? hours.start : null,
      end: typeof hours.end === 'string' ? hours.end : null,
    } as Profile['availability']['hours'],
  }
}

function parseLookingFor(value: unknown): Profile['lookingFor'] {
  if (!isRecord(value)) return { roles: [] }
  return { roles: toStringArray(value.roles) }
}

type ValidRow = PublicProfileRow & {
  id: string
  full_name: string
  timezone: string
  created_at: string
  updated_at: string
}

function isPublicProfileRow(row: PublicProfileRow): row is ValidRow {
  return (
    typeof row.id === 'string' &&
    typeof row.full_name === 'string' &&
    typeof row.timezone === 'string' &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  )
}

// S15 — browse-ready predicate (single TS twin of the SQL gate in migration
// 20260912020000). Mirrors `BROWSE_FIELDS` (fullName, role, bio) of
// `services/profiles/completeness.ts`. The discover pool relies on the DB view
// as the primary gate; this pure guard is a belt-and-suspenders safety net for
// non-view call-sites so a browse-ineligible row is never emitted.
export function isDiscoverEligibleRow(row: {
  role: string | null
  bio: string | null
  full_name?: string | null
}): boolean {
  return (
    typeof row.role === 'string' &&
    row.role.length > 0 &&
    typeof row.bio === 'string' &&
    row.bio.trim().length > 0
  )
}

export function rowToPublicProfile(row: ValidRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role ?? 'other',
    bio: row.bio,
    skills: row.skills || [],
    // City-only slot — public candidate rows may not expose it; absent = never fabricated.
    city: null,
    availability: parseAvailability(row.availability),
    timezone: row.timezone,
    lookingFor: parseLookingFor(row.looking_for),
    offering: { categories: [] },
    visibility: row.visibility ?? 'public',
    commitmentLevel: row.commitment_level,
    workStyle: row.work_style,
    lastActiveAt: row.last_active_at, // #51: no updated_at fabrication
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // #49: public candidate rows don't carry onboarding state — null, never
    // a fabricated value. Viewers' own state is resolved separately.
    onboardingStatus: null,
    onboardingCompletedAt: null,
  }
}

export function profileToMatchingProfile(profile: Profile): ProfileForMatching {
  return {
    id: profile.id,
    role: profile.role || 'other',
    skills: profile.skills,
    timezone: profile.timezone || 'UTC',
    availability: profile.availability,
    lookingFor: profile.lookingFor,
    lastActiveAt: profile.lastActiveAt ?? profile.updatedAt,
    visibility: profile.visibility,
  }
}

// ── S15 — SQL-boundary order: hard filters → bounded pool ───────────────
// The discover pool query carries the lossless hard-filter predicates in its
// WHERE (built by `filtersToQueryConditions`, which mirrors the exact JS
// comparisons in `matchesHardFilters`). Applying them here — INSIDE the query
// chain, before any pool cap — is what guarantees the query never returns
// hard-filter-mismatched rows that could consume cap slots. `skill` (exact
// case-insensitive over text[]) has no lossless PostgREST operator, so it is
// intentionally NOT pushed and stays in the JS `matchesHardFilters` net (see
// filters.schema.ts).
type PoolQueryBuilder = {
  eq: (column: string, value: unknown) => PoolQueryBuilder
  gte: (column: string, value: unknown) => PoolQueryBuilder
  like: (column: string, value: unknown) => PoolQueryBuilder
  filter: (column: string, operator: string, value: unknown) => PoolQueryBuilder
}

function applyPoolQueryConditions(
  builder: PoolQueryBuilder,
  conditions: PoolQueryCondition[],
): PoolQueryBuilder {
  for (const condition of conditions) {
    switch (condition.operator) {
      case 'eq':
        builder = builder.eq(condition.column, condition.value)
        break
      case 'gte':
        builder = builder.gte(condition.column, condition.value)
        break
      case 'like':
        builder = builder.like(condition.column, condition.value)
        break
      case 'cs':
        builder = builder.filter(condition.column, 'cs', condition.value)
        break
    }
  }
  return builder
}

/**
 * Fetch one bounded batch of ranked Discover candidates.
 * Offset paging is safe: the ranked list is deterministic (S038 pipeline)
 * and epoch-versioned per user, so a cursor never mixes epochs.
 */
export async function getDiscoverBatch(
  userId: string,
  opts: { offset?: number; limit?: number; filters?: MatchFiltersInput },
): Promise<DiscoverBatch> {
  const offset = Math.max(0, Math.trunc(opts.offset ?? 0))
  const limit = Math.min(
    Math.max(1, Math.trunc(opts.limit ?? DISCOVER_BATCH_LIMIT)),
    50,
  )
  const filters = (opts.filters ?? {}) as MatchFiltersInput

  const supabase = await createServerSupabaseClient()
  const admin = getAdminSupabaseClient()
  const db = admin ?? supabase

  const profile = await getProfile(userId)
  if (!profile) {
    return { items: [], nextCursorToken: null, version: 'empty' }
  }
  const reference = profileToMatchingProfile(profile)

  // #168 — hard eligibility: already-dismissed/matched candidates are
  // excluded at the DB boundary so they cannot consume the pool cap or the
  // ranking budget (audit pipeline: DB hard eligibility → safety → score).
  const dismissedCandidateIds = await fetchDismissedCandidateIds(
    db as unknown as DismissedSource,
    userId,
  )

  let poolQuery = db
    .from('public_profiles')
    .select(
      'id, full_name, avatar_url, role, bio, skills, availability, timezone, looking_for, commitment_level, work_style, visibility, last_active_at, created_at, updated_at',
    )
    .neq('id', userId)

  if (dismissedCandidateIds.size > 0) {
    poolQuery = poolQuery.not('id', 'in', Array.from(dismissedCandidateIds))
  }

  // S15 — hard filters land in the WHERE (SQL-boundary order: hard filters
  // BEFORE the bounded pool). The pool query is deliberately NOT capped here:
  // a `.limit(DISCOVER_POOL_CAP)` before the directional-blocks pass would let
  // blocked rows consume cap slots and starve eligible candidates — the exact
  // forbidden `select first 100 → filter in JS` pattern. The cap is applied to
  // the surviving list only (post-block, post-hard-filter) below.
  const poolQueryConditions = filtersToQueryConditions(filters)
  poolQuery = applyPoolQueryConditions(
    poolQuery as unknown as PoolQueryBuilder,
    poolQueryConditions,
  ) as unknown as typeof poolQuery

  const { data: rawRows, error } = await poolQuery

  if (error) {
    logger.error('Discover candidate query failed', {
      userId,
      error: error.message,
    })
    return { items: [], nextCursorToken: null, version: 'error' }
  }

  const rows = (rawRows ?? []) as unknown as PublicProfileRow[]

  // S15 — previous-interactions re-application: the `.not("id","in", dismissed)`
  // above stays the DB-boundary gate; this JS mirror only closes the
  // read→query race (a swipe landing between the dismissed lookup and the pool
  // fetch could otherwise slip one row through). Both run before blocks/hard
  // filters, so the cap below never counts an interacted candidate.
  const notInteractedRows = rows.filter(
    (row) => row.id !== null && !dismissedCandidateIds.has(row.id),
  )
  const publicRows = notInteractedRows.filter(isPublicProfileRow)

  // S15 — directional blocks: safety seam reads both block directions
  // (viewer→candidate and candidate→viewer) and is applied to the FETCHED rows
  // BEFORE the bounded-pool cap, so a blocked candidate can never occupy a cap
  // slot or the ranking budget.
  const allowedIds = new Set(
    (
      await filterBlockedCandidates(
        userId,
        publicRows.map((r) => ({ id: r.id })),
      )
    ).map((r) => r.id),
  )

  // S15 — browse-ready + visibility + suspension are ALL enforced by the pool
  // view (`public_profiles`: visibility IN {public,recruiting} AND suspended_at
  // IS NULL AND full_name/role/bio present — migrations 20260911020000,
  // 20260912020000). Re-filtering them here would reproduce a
  // "select first N → filter in JS" pass and waste the pool cap, so they are
  // never re-checked as identical filters. `isDiscoverEligibleRow` is a pure
  // safety net for non-view call-sites, not the primary gate. Remaining
  // JS-only stages: directional blocks (safety) + user hard filters.
  const hardFiltered = publicRows
    .filter((row) => allowedIds.has(row.id) && isDiscoverEligibleRow(row))
    .filter((row) =>
      matchesHardFilters(
        {
          role: row.role ?? 'other',
          skills: row.skills,
          availability: parseAvailability(row.availability),
          timezone: row.timezone ?? 'UTC',
          workStyle: row.work_style,
          commitmentLevel: row.commitment_level,
          lastActiveAt: row.last_active_at,
        },
        filters,
      ),
    )

  // S15 — bounded pool: applied to the POST-block, POST-hard-filter candidate
  // list ONLY. The SQL query is uncapped by design (see pool query above), so
  // every eligible candidate is examined before any cap — blocked and
  // hard-mismatched rows can never consume a cap slot or the ranking budget.
  const poolRows = hardFiltered.slice(0, DISCOVER_POOL_CAP)
  const candidateProfiles = poolRows.map(rowToPublicProfile)
  const matchingCandidates = candidateProfiles.map(profileToMatchingProfile)
  const weights = await loadWeights()

  const matchingResult = await getTopCandidates(
    userId,
    reference,
    matchingCandidates,
    weights,
    DISCOVER_POOL_CAP, // rank the bounded eligible pool once; page over it
  )

  // HOST-DB-02 — persist the server-computed compatibility scores into the
  // server-owned recommendation_scores table so the perform_swipe RPC can
  // derive them instead of trusting a client-supplied value. This runs only
  // after scoring via the admin client (service role); a failure is
  // non-fatal to the discover read path (the swipe RPC falls back to 0 when
  // no score row exists).
  await persistRecommendationScores(
    userId,
    matchingResult.candidates
      .filter((c) => Number.isFinite(c.score))
      .map((c) => ({ candidateId: c.candidateId, score: Math.round(c.score) })),
  )

  const profileMap = new Map(candidateProfiles.map((p) => [p.id, p]))

  const nextOffset = offset + limit
  const exhausted = nextOffset >= matchingResult.candidates.length
  const epoch = await getDiscoverEpoch(userId)
  const version = `${epoch}:${matchingResult.pipeline?.reranker ?? 'identity.v1'}`

  // S17/17A — mint a signed snapshot per card and attach it INSIDE its item so
  // the browser's swipe sends `recommendationId` (never a score). `expiresAt`
  // is captured once per batch so every card in the deck shares one deadline.
  const expiresAt = new Date(
    Date.now() + RECOMMENDATION_SNAPSHOT_TTL_MS,
  ).toISOString()
  const ranked = matchingResult.candidates.slice(offset, offset + limit)
  const items: DiscoverCandidateDTO[] = []
  for (const candidate of ranked) {
    const candidateProfile = profileMap.get(candidate.candidateId)
    if (!candidateProfile) continue
    // Strip nothing else: `rerankScore`/`rankOrigin` remain on the card for the
    // client's (read-only) sort display, but the HMAC snapshot — not the echo
    // — is the swipe authority.
    items.push({
      ...candidate,
      profile: candidateProfile,
      recommendation: mintRecommendationSnapshot(
        userId,
        candidate,
        epoch,
        expiresAt,
      ),
    })
  }

  return {
    items,
    nextCursorToken: exhausted
      ? null
      : encodeCursorToken(userId, nextOffset, version),
    version,
  }
}
