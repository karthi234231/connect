// src/services/profiles/onboarding.ts
// S06 → S10 — Onboarding state model: a deterministic, pure state machine that
// separates onboarding completion from profile completeness, extended into a
// durable STEP model for the onboarding route (S10).
//
// Product rules (§0):
//   - Onboarding minimum = LinkedIn identity + Bio + Looking for + Offering.
//     (P0-08: the old `profileIdea` requirement was a phantom — there is no
//     persisted profile-idea column, so it is removed rather than satisfied
//     vacuously. Every remaining requirement maps to a real stored field.)
//   - A 30%-complete profile can still be onboarded (the two states are
//     orthogonal — completeness never gates onboarding and vice versa).
//
// S10 step model — additive; the S06 machine below is untouched. The step a
// user is ON is derived purely from PERSISTED profile state
// (deriveCurrentStep). A visited page is never treated as a completed step:
// completion always derives from what `computeOnboardingState` says about the
// stored profile. Refreshing therefore lands the user back on the exact step
// their persisted fields justify — no session/localStorage authority.

export type OnboardingStatus = 'pending' | 'completed'

/** The minimum PERSISTED requirements a user must satisfy to complete onboarding. */
export const ONBOARDING_REQUIREMENTS = [
  'linkedinIdentity',
  'bio',
  'lookingFor',
  'offering',
] as const

export type OnboardingRequirement = (typeof ONBOARDING_REQUIREMENTS)[number]

/** Inputs the onboarding state machine derives from a profile + auth identity. */
export interface OnboardingInputs {
  hasLinkedinIdentity: boolean
  hasBio: boolean
  hasLookingFor: boolean
  hasOffering: boolean
}

export interface OnboardingState {
  status: OnboardingStatus
  isOnboarded: boolean
  /** Requirements still unmet while pending (empty when completed). */
  missingRequirements: OnboardingRequirement[]
  /** True when the minimum is met and the pending→completed write may run. */
  canComplete: boolean
}

function collectMissing(inputs: OnboardingInputs): OnboardingRequirement[] {
  const missing: OnboardingRequirement[] = []
  if (!inputs.hasLinkedinIdentity) missing.push('linkedinIdentity')
  if (!inputs.hasBio) missing.push('bio')
  if (!inputs.hasLookingFor) missing.push('lookingFor')
  if (!inputs.hasOffering) missing.push('offering')
  return missing
}

/**
 * Derive the onboarding state from the minimum requirements.
 * Deterministic: same inputs → same outputs, no side effects.
 */
export function computeOnboardingState(
  inputs: OnboardingInputs,
): OnboardingState {
  const missing = collectMissing(inputs)
  return {
    status: missing.length === 0 ? 'completed' : 'pending',
    isOnboarded: missing.length === 0,
    missingRequirements: missing,
    canComplete: missing.length === 0,
  }
}

/**
 * Idempotent transition for a persisted row: once completed, onboarding stays
 * completed regardless of later edits (retry/repeat is a no-op).
 * Returns the status that should be persisted plus the timestamp decision.
 */
export function transitionOnboarding(
  current: OnboardingStatus,
  minimumMet: boolean,
): { status: OnboardingStatus; changed: boolean; completedAt: string | null } {
  if (current === 'completed') {
    return { status: 'completed', changed: false, completedAt: null }
  }
  if (!minimumMet) {
    return { status: 'pending', changed: false, completedAt: null }
  }
  return {
    status: 'completed',
    changed: true,
    completedAt: new Date().toISOString(),
  }
}

// ─── S10 durable STEP model ───────────────────────────────────────────────
// The onboarding flow UI renders these steps in order. Every step (except the
// terminal "Discover ready") persists its fields on save, so the index the
// route derives on mount is always the truth — never a session artifact.

export const ONBOARDING_STEPS = [
  { id: 'linkedinIdentity', title: 'LinkedIn identity' },
  { id: 'about', title: 'About you' },
  { id: 'lookingFor', title: 'Looking for' },
  { id: 'offering', title: 'Offering' },
  { id: 'optionalContext', title: 'Ideas, skills & interests' },
  { id: 'discoverReady', title: 'Discover ready' },
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id']

/**
 * The minimal PERSISTED-profile shape deriveCurrentStep / toOnboardingInputs
 * need. Structurally satisfied by OwnerProfileProjection (projection.ts) so
 * the route can pass one straight through — no import cycle, no coupling to
 * the projection module from this pure module.
 */
export interface OnboardingProjectionInput {
  identity: { fullName: string }
  bio: string | null
  lookingFor: { roles: string[] }
  offering: { categories: string[] }
  onboardingStatus: OnboardingStatus
}

/**
 * Pure + deterministic. Returns the current step index from persisted profile
 * state only:
 *   identity present → about, bio present → lookingFor,
 *   lookingFor present → offering, offering present → optional/ready.
 * "Completed" (persisted onboarding_status) always wins → Discover ready.
 */
export function deriveCurrentStep(input: OnboardingProjectionInput): number {
  if (input.onboardingStatus === 'completed') {
    // Discover ready — persisted completion is the only authority here.
    return ONBOARDING_STEPS.length - 1
  }
  if (input.identity.fullName.trim().length === 0) return 0
  if (!input.bio || input.bio.trim().length === 0) return 1
  if (input.lookingFor.roles.length === 0) return 2
  if (input.offering.categories.length === 0) return 3
  // identity + bio + lookingFor + offering persisted but still pending →
  // the optional ideas/skills/interests step (finish = complete onboarding).
  return 4
}

/**
 * Map PERSISTED profile state to the S06 machine inputs. Every flag reads a
 * real stored field (P0-07/P0-08) — the caller must pass the profile it just
 * read, never empty placeholders, so completion validation always agrees with
 * the saved profile state.
 */
export function toOnboardingInputs(
  input: OnboardingProjectionInput,
): OnboardingInputs {
  return {
    hasLinkedinIdentity: input.identity.fullName.trim().length > 0,
    hasBio: Boolean(input.bio && input.bio.trim().length > 0),
    hasLookingFor: input.lookingFor.roles.length > 0,
    hasOffering: input.offering.categories.length > 0,
  }
}
