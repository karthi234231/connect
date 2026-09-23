// src/services/matching/compatibility.ts

/**
 * Profile data required for compatibility scoring.
 */
export interface ProfileForMatching {
  id: string
  skills: string[]
  role: string
  timezone: string
  availability: {
    days: string[]
    hours: { start: string; end: string } | null
  }
  lookingFor: { roles: string[] }
  lastActiveAt: string | null
  visibility: 'public' | 'recruiting' | 'private' | 'stealth'
}

/**
 * Factor weights as loaded from DB.
 * Sum should be 100.
 */
export interface MatchingWeights {
  skill: number
  intent: number
  role: number
  availability: number
  activity: number
  timezone: number
  diversity: number
}

/**
 * Score breakdown for explainability.
 */
export const SCORE_VERSION = 'v4'

export interface ScoreBreakdown {
  skill: number
  role: number
  timezone: number
  availability: number
  intent: number
  activity: number
  diversity: number
  total: number
  /** Version of the scoring formula that produced this breakdown (S18). */
  scoreVersion: string
}

/**
 * Compute Jaccard similarity between two sets.
 * Returns 0-100.
 */
export function jaccardScore(setA: string[], setB: string[]): number {
  if (!setA.length || !setB.length) return 0

  // #101 — O(n+m) via Set intersection; skills are canonicalized
  // (lowercase/trim) at ingestion (#102), but normalize defensively here so
  // legacy rows never double-count case variants.
  const canon = (s: string) => s.trim().toLowerCase()

  const b = new Set(setB.map(canon))
  let intersection = 0
  const a = new Set<string>()
  for (const item of setA) {
    const key = canon(item)
    if (a.has(key)) continue // dedupe A-side for union correctness
    a.add(key)
    if (b.has(key)) intersection++
  }

  const union = new Set([...a, ...b]).size
  if (union === 0) return 0
  return Math.round((intersection / union) * 100)
}

/**
 * Skill score: Jaccard similarity between two skill sets.
 */
export function skillScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  return jaccardScore(a.skills, b.skills)
}

/**
 * Audit #97 — role complementarity is VERSIONED CONFIGURATION, not hard-coded
 * algorithm source. Changing the role taxonomy means editing this single
 * config object (and bumping `version`), never touching the scoring algorithm.
 * Every rule is exercised by unit tests (compatibility.test.ts).
 */
export interface RoleRule {
  match: (roleA: string, roleB: string) => boolean
  score: number
  reason: string
}

export const ROLE_COMPLEMENTARITY_CONFIG: {
  version: number
  categories: { founder: string[]; builder: string[]; other: string[] }
  rules: RoleRule[]
  missingRoleScore: number
  defaultScore: number
} = {
  version: 1,
  categories: {
    founder: ['founder'],
    builder: ['engineer', 'designer'],
    other: ['product', 'growth', 'operations', 'data_ml'],
  },
  rules: [
    {
      // founder ↔ builder — the strongest pairing.
      match: (a, b) =>
        (a === 'founder' && kompatBuilder(b)) ||
        (b === 'founder' && kompatBuilder(a)),
      score: 100,
      reason: 'founder_builder',
    },
    {
      // founder ↔ other operator/PM roles — strong pairing.
      match: (a, b) =>
        (a === 'founder' && kompatOther(b)) ||
        (b === 'founder' && kompatOther(a)),
      score: 80,
      reason: 'founder_other',
    },
    {
      // same role — low complementarity (must precede builder↔builder).
      match: (a, b) => a === b,
      score: 30,
      reason: 'same_role',
    },
    {
      // builder ↔ builder — complementary engineering/design.
      match: (a, b) => kompatBuilder(a) && kompatBuilder(b),
      score: 60,
      reason: 'builder_builder',
    },
  ],
  missingRoleScore: 30,
  defaultScore: 50,
}

function kompatBuilder(role: string): boolean {
  return ROLE_COMPLEMENTARITY_CONFIG.categories.builder.includes(role)
}

function kompatOther(role: string): boolean {
  return ROLE_COMPLEMENTARITY_CONFIG.categories.other.includes(role)
}

/**
 * Config-driven role complementarity (audit #97). Returns the first matching
 * rule's score, falling back to `defaultScore` when no rule applies.
 */
export function roleComplementarityScore(
  roleA: string | null,
  roleB: string | null,
): number {
  if (!roleA || !roleB) {
    return ROLE_COMPLEMENTARITY_CONFIG.missingRoleScore
  }

  for (const rule of ROLE_COMPLEMENTARITY_CONFIG.rules) {
    if (rule.match(roleA, roleB)) {
      return rule.score
    }
  }

  return ROLE_COMPLEMENTARITY_CONFIG.defaultScore
}

/**
 * Role complementarity score.
 * Founder ↔ engineer/designer high; same-role low.
 * 0-100.
 */
export function roleScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  return roleComplementarityScore(a.role, b.role)
}

/**
 * Timezone score: inverse of absolute hour difference, capped.
 * 0-100.
 */

/**
 * Timezone score: inverse of absolute hour difference, capped.
 * Computes the true UTC offset for each zone at the current instant (DST-aware)
 * via Intl formatToParts - never parses timezone abbreviations. 0-100.
 */
export function timezoneScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  const tzA = a.timezone
  const tzB = b.timezone
  if (!tzA || !tzB) return 30
  const offsetMin = (tz: string): number | null => {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(new Date())
          .filter((p) => p.type !== 'literal')
          .map((p) => [p.type, p.value]),
      )
      const localAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      )
      return Math.round((localAsUtc - Date.now()) / 60000)
    } catch {
      return null
    }
  }
  const offA = offsetMin(tzA)
  const offB = offsetMin(tzB)
  if (offA === null || offB === null) return 30
  const diffHours = Math.abs(offA - offB) / 60
  if (diffHours <= 1) return 100
  if (diffHours <= 4) return 70
  if (diffHours <= 8) return 50
  if (diffHours <= 12) return 30
  return 10
}

/**
 * Availability overlap in REAL simultaneous time (#30).
 * Each user's weekly slot is interpreted in their own IANA timezone,
 * converted to UTC minute-of-week (DST-correct via current offset),
 * then intervals are intersected with ±week shifts for day rollover.
 * Returns 0-100.
 */
const WEEK_MIN = 7 * 24 * 60
/** Reference anchor: 2024-01-01 was a Monday. Day index 0 = mon. */
const ANCHOR_MONDAY_UTC = Date.UTC(2024, 0, 1)

/** Offset (minutes) of tz at a given instant (DST-correct). */
function tzOffsetMinutesAt(tz: string, at: number): number | null {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(at))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    )
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    return Math.round((localAsUtc - at) / 60000)
  } catch {
    return null
  }
}

const DAY_INDEX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
}

/**
 * Convert a weekly slot (day + local HH:mm in tz) to a UTC minute-of-week.
 */
function slotToUtcMinuteOfWeek(
  day: string,
  hhmm: string,
  tz: string,
): number | null {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const dayIdx = DAY_INDEX[day.toLowerCase().slice(0, 3)]
  if (dayIdx === undefined) return null
  // Approximate instant for this slot, then refine with the offset at it
  // (one refinement pass is sufficient for weekly granularity; DST shifts
  // within the hour are handled by re-reading the offset at the result).
  const guess = ANCHOR_MONDAY_UTC + dayIdx * 24 * 60 * 60000
  let offset = tzOffsetMinutesAt(tz, guess)
  if (offset === null) return null
  const utcMs = guess + toMinutes(hhmm) * 60000 - offset * 60000
  offset = tzOffsetMinutesAt(tz, utcMs) ?? offset
  const utcMs2 = guess + toMinutes(hhmm) * 60000 - offset * 60000
  return ((Math.round(utcMs2 / 60000) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN
}

/** Length of intersection of two possibly-wrapping minute-of-week intervals. */
function intervalOverlapMin(
  s1: number,
  e1: number,
  s2: number,
  e2: number,
): number {
  // Unwrap both to linear intervals on [0, 2*WEEK_MIN).
  const norm = (s: number, e: number): [number, number] =>
    e <= s ? [s, e + WEEK_MIN] : [s, e]
  const [a1, b1] = norm(s1, e1)
  const [a2, b2] = norm(s2, e2)
  let total = 0
  for (const shift of [-WEEK_MIN, 0, WEEK_MIN]) {
    const lo = Math.max(a1, a2 + shift)
    const hi = Math.min(b1, b2 + shift)
    if (hi > lo) total += hi - lo
  }
  return total
}

export function availabilityScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  const availA = a.availability
  const availB = b.availability
  if (!availA || !availB) return 0

  // #50: without real working hours we can't compute time overlap. Fall back
  // to a days-only overlap ratio (partial credit for shared days), never a
  // fabricated default window.
  if (!availA.hours || !availB.hours) {
    const daysA = new Set(availA.days)
    const shared = availB.days.filter((d) => daysA.has(d)).length
    const denom = Math.max(1, Math.min(availA.days.length, availB.days.length))
    return Math.round((shared / denom) * 100)
  }

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const durationA = toMinutes(availA.hours.end) - toMinutes(availA.hours.start)
  const durationB = toMinutes(availB.hours.end) - toMinutes(availB.hours.start)
  if (durationA <= 0 || durationB <= 0) return 0

  // Convert every labelled day-slot of each user to UTC minute-of-week.
  const slotsA: Array<[number, number]> = []

  for (const day of availA.days) {
    const s = slotToUtcMinuteOfWeek(day, availA.hours.start, a.timezone)
    const e = slotToUtcMinuteOfWeek(day, availA.hours.end, a.timezone)
    if (s !== null && e !== null) slotsA.push([s, e])
  }
  const slotsB: Array<[number, number]> = []
  for (const day of availB.days) {
    const s = slotToUtcMinuteOfWeek(day, availB.hours.start, b.timezone)
    const e = slotToUtcMinuteOfWeek(day, availB.hours.end, b.timezone)
    if (s !== null && e !== null) slotsB.push([s, e])
  }
  if (slotsA.length === 0 || slotsB.length === 0) return 0

  let overlapMinutes = 0
  for (const [sA, eA] of slotsA) {
    for (const [sB, eB] of slotsB) {
      overlapMinutes += intervalOverlapMin(sA, eA, sB, eB)
    }
  }
  if (overlapMinutes <= 0) return 0

  const avgDuration = (durationA + durationB) / 2
  const overlapRatio = overlapMinutes / avgDuration
  return Math.round(Math.min(overlapRatio * 100, 100))
}

/**
 * Intent score: directional fit - does A fit what B wants, and vice-versa?
 * Mutual (both directions) is highest; one-sided is medium; neither is low.
 * The founder-to-engineer mutual-intent case scores high. 0-100.
 */
export function intentScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  const rolesA = (a.lookingFor?.roles ?? []) as string[]
  const rolesB = (b.lookingFor?.roles ?? []) as string[]
  if (!rolesA.length || !rolesB.length) return 0
  const aFitsB = rolesB.includes(a.role)
  const bFitsA = rolesA.includes(b.role)
  if (aFitsB && bFitsA) return 100
  if (aFitsB || bFitsA) return 55
  const shared = rolesA.filter((r) => rolesB.includes(r)).length
  return shared > 0 ? 25 : 10
}

/**
 * Activity score: recency of last active.
 * Returns 0-100.
 */
export function activityScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return 30
    const diff = Date.now() - new Date(dateStr).getTime()
    return diff / (1000 * 60 * 60 * 24)
  }
  const daysA = getDaysSince(a.lastActiveAt)
  const daysB = getDaysSince(b.lastActiveAt)
  const avgDays = (daysA + daysB) / 2
  if (avgDays < 3) return 100
  if (avgDays < 7) return 70
  if (avgDays < 14) return 40
  if (avgDays < 30) return 20
  return 0
}

const ROLE_CLUSTERS: Record<string, string> = {
  founder: 'founder',
  engineer: 'builder',
  designer: 'builder',
  product: 'business',
  growth: 'business',
  operations: 'business',
  data_ml: 'business',
} as const
function roleCluster(role: string): string {
  return ROLE_CLUSTERS[role] ?? 'other'
}
function ianaRegion(timezone: string): string {
  return timezone.split('/')[0]?.toLowerCase() ?? ''
}
/**
 * Diversity score (anti-echo chamber): 100 (diverse) - exposure penalty.
 * Penalties: same role-cluster (+0.45) and same IANA region (+0.35). This is a
 * controlled, diminishing-return penalty - "different" is not universally
 * better; the factor only affects ranking when its weight is configured. 0-100.
 */
export function diversityScore(
  a: ProfileForMatching,
  b: ProfileForMatching,
): number {
  let penalty = 0
  const clusterA = roleCluster(a.role)
  const clusterB = roleCluster(b.role)
  if (clusterA !== 'other' && clusterA === clusterB) penalty += 0.45
  const rA = ianaRegion(a.timezone)
  const rB = ianaRegion(b.timezone)
  if (rA && rA === rB) penalty += 0.35
  return Math.round(100 * (1 - Math.min(penalty, 0.9)))
}

/**
 * Compute full breakdown for two profiles.
 */
export function computeBreakdown(
  a: ProfileForMatching,
  b: ProfileForMatching,
  weights: MatchingWeights,
): ScoreBreakdown {
  const skill = skillScore(a, b)
  const role = roleScore(a, b)
  const timezone = timezoneScore(a, b)
  const availability = availabilityScore(a, b)
  const intent = intentScore(a, b)
  const activity = activityScore(a, b)
  const diversity = diversityScore(a, b)

  const total =
    skill * (weights.skill / 100) +
    role * (weights.role / 100) +
    timezone * (weights.timezone / 100) +
    availability * (weights.availability / 100) +
    intent * (weights.intent / 100) +
    activity * (weights.activity / 100) +
    diversity * (weights.diversity / 100)

  return {
    skill,
    role,
    timezone,
    availability,
    intent,
    activity,
    diversity,
    total: Math.round(total),
    scoreVersion: SCORE_VERSION,
  }
}
