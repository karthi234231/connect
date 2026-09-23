// src/services/profiles/intent.ts
// V10-BE-06 — Canonical Looking For / Offering taxonomy.
//
// ONE authority for collaboration-intent categories shared across Profile,
// Discover, matching, Events, Ideas and the frontend. No per-component
// strings, no duplicated label maps, no ranking semantics encoded in copy.
//
// Values are deliberately kept in lockstep with the role vocabulary
// (src/lib/validation.ts `roleSchema`): directional matching
// (src/services/matching/compatibility.ts `intentScore`) compares a partner's
// `role` against your `looking_for.roles`. If the role enum ever changes, that
// lockstep is enforced here AND asserted in tests so the two can never drift
// silently. Matching scoring itself is NOT changed in this mini-session.
//
// Ordering is canonical and fixed (role enum order). Descriptions are neutral
// attribute statements — they never rank categories against each other.

import { z } from 'zod'
import { roleSchema } from '@/lib/validation'

/** Canonical category values (ordered). Derived from the role vocabulary. */
export const COLLABORATION_INTENT_VALUES = roleSchema.options

export type CollaborationIntent = (typeof COLLABORATION_INTENT_VALUES)[number]

/** A category the user is seeking in a team partner. */
export type LookingForIntent = CollaborationIntent

/** A category the user contributes to a collaboration. */
export type OfferingIntent = CollaborationIntent

export interface IntentCategoryMeta<V extends string> {
  value: V
  label: string
  description: string
}

// Shared human-first labels (one map, reused by both directions).
const INTENT_LABELS: Record<CollaborationIntent, string> = {
  founder: 'Founder',
  engineer: 'Engineer',
  designer: 'Designer',
  product: 'Product',
  growth: 'Growth',
  operations: 'Operations',
  data_ml: 'Data & ML',
  other: 'Other',
}

// Looking For copy: what the user is seeking.
const LOOKING_FOR_DESCRIPTIONS: Record<CollaborationIntent, string> = {
  founder:
    'Looking to team up with a founder — co-founding or partnering on a company.',
  engineer: 'Looking to build with an engineer who ships hands-on.',
  designer: 'Looking for a designer to shape product and brand.',
  product: 'Looking for product thinking to own roadmap and priorities.',
  growth: 'Looking for growth and marketing to find and keep users.',
  operations: 'Looking for operations and finance rigor to run the business.',
  data_ml:
    'Looking for data and ML strength to build intelligence into the product.',
  other: 'Looking for another discipline not listed here.',
}

// Offering copy: what the user contributes to a collaboration.
const OFFERING_DESCRIPTIONS: Record<CollaborationIntent, string> = {
  founder: 'Brings founding instincts and 0-to-1 product leadership.',
  engineer: 'Brings hands-on engineering and a habit of shipping.',
  designer: 'Brings product and brand design craft.',
  product: 'Brings product strategy and roadmap ownership.',
  growth: 'Brings acquisition, retention and growth loops.',
  operations: 'Brings operations, finance and execution discipline.',
  data_ml: 'Brings data science and ML engineering.',
  other: 'Brings another discipline not listed here.',
}

function toCategories<V extends string>(
  descriptions: Record<CollaborationIntent, string>,
): readonly IntentCategoryMeta<V>[] {
  return COLLABORATION_INTENT_VALUES.map((value) => ({
    value: value as V,
    label: INTENT_LABELS[value],
    description: descriptions[value],
  }))
}

/** Canonical ordered Looking For categories (role order). */
export const LOOKING_FOR_CATEGORIES: readonly IntentCategoryMeta<LookingForIntent>[] =
  toCategories<LookingForIntent>(LOOKING_FOR_DESCRIPTIONS)

/** Canonical ordered Offering categories (role order). */
export const OFFERING_CATEGORIES: readonly IntentCategoryMeta<OfferingIntent>[] =
  toCategories<OfferingIntent>(OFFERING_DESCRIPTIONS)

/** Shared label resolver — the single place UI text can come from. */
export function getIntentLabel(value: string): string | null {
  return INTENT_LABELS[value as CollaborationIntent] ?? null
}

export function getLookingForDescription(value: string): string | null {
  return LOOKING_FOR_DESCRIPTIONS[value as CollaborationIntent] ?? null
}

export function getOfferingDescription(value: string): string | null {
  return OFFERING_DESCRIPTIONS[value as CollaborationIntent] ?? null
}

export function getLookingForCategory(
  value: string,
): IntentCategoryMeta<LookingForIntent> | null {
  return LOOKING_FOR_CATEGORIES.find((c) => c.value === value) ?? null
}

export function getOfferingCategory(
  value: string,
): IntentCategoryMeta<OfferingIntent> | null {
  return OFFERING_CATEGORIES.find((c) => c.value === value) ?? null
}

// ─── Trust-boundary validation (shared by profile create/update) ──────────
// Unknown/arbitrary strings are REJECTED here, so no free-form intent ever
// reaches storage. Missing/empty intent is always allowed at the update
// boundary — absence is never treated as a negative identity judgment.

export const lookingForCategorySchema = z.enum(COLLABORATION_INTENT_VALUES)

export const offeringCategorySchema = z.enum(COLLABORATION_INTENT_VALUES)

export const lookingForSchema = z
  .object({
    roles: z
      .array(lookingForCategorySchema)
      .min(1, { message: "Select at least one role you're looking for." }),
  })
  .strict()

export const offeringSchema = z
  .object({
    categories: z.array(offeringCategorySchema).max(20),
  })
  .strict()

export type LookingForInput = z.infer<typeof lookingForSchema>
export type OfferingInput = z.infer<typeof offeringSchema>
