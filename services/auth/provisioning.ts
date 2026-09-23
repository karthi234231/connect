// src/services/auth/provisioning.ts
// S08 — Identity provisioning + deterministic callback routing.
//
// Flow: code exchange (callback) → user → profile lookup → atomic create/sync
// → onboarding state → redirect intent. The browser is never the authority.
//
// Latency contract: one profile query + one state decision; the optional
// provider-sync write runs only when provider data can fill EMPTY user-owned
// fields (S05 gate: a provider never overwrites user-edited data).
//
// Atomicity/gate: profile creation uses an upsert with ignoreDuplicates on the
// primary key — concurrent callbacks for the same user can never create a
// duplicate profile row.

import {
  computeOnboardingState,
  type OnboardingInputs,
} from '@/services/profiles/onboarding'
import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { PROFILE_FIELD_OWNER } from '@/services/profiles/field-ownership'
import { isSafeRedirectUrl } from '@/lib/security'
import type { Profile } from '@/services/profiles/mappers'

/** Minimal auth-user shape (from Supabase after exchange) — no SDK coupling. */
export interface AuthUserLike {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

export interface ProvisioningDecision {
  /** Columns to write when the profile row does not exist yet. */
  create: Record<string, unknown> | null
  /** Columns to write when the profile exists but has empty user-owned fields. */
  sync: Record<string, unknown> | null
  onboardingInputs: OnboardingInputs
  /** Final redirect target decided by the server (never client-supplied unsanitized). */
  redirectTo: string
  /** True when this callback provisioned a brand-new profile. */
  isNewProfile: boolean
}

function metaString(user: AuthUserLike, keys: string[]): string | null {
  const meta = user.user_metadata ?? {}
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim().length > 0)
      return value.trim()
  }
  return null
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

/**
 * Pure decision function: given the auth user and their (possibly missing)
 * profile, produce the provisioning writes + redirect intent.
 * `decideRedirect` is injected for testability; prod passes isSafeRedirectUrl.
 */
export function decideProvisioning(
  user: AuthUserLike,
  profile: Profile | null,
  decideRedirect: (candidate: string) => boolean = isSafeRedirectUrl,
): ProvisioningDecision {
  const fullName = metaString(user, ['full_name', 'name'])
  const avatarUrl = metaString(user, ['avatar_url', 'picture'])

  let create: Record<string, unknown> | null = null
  let sync: Record<string, unknown> | null = null
  let isNewProfile = false

  if (!profile) {
    isNewProfile = true
    create = { id: user.id }
    if (fullName) create.full_name = fullName
    if (avatarUrl) create.avatar_url = avatarUrl
    // Only known profile columns are written; email is NOT persisted (no such
    // column — S03 DB truth). Never write system-owned columns via identity;
    // user- AND provider-owned columns may be provisioned from the LinkedIn
    // OIDC identity on first sign-in (S08 ownership map).
    create = Object.fromEntries(
      Object.entries(create).filter(
        ([key]) =>
          key === 'id' ||
          PROFILE_FIELD_OWNER[key] === 'user' ||
          PROFILE_FIELD_OWNER[key] === 'provider',
      ),
    )
  } else {
    // Provider sync fills EMPTY user-owned fields only — never overwrites.
    const patch: Record<string, unknown> = {}
    if (isEmpty(profile.fullName) && fullName) patch.full_name = fullName
    if (isEmpty(profile.avatarUrl) && avatarUrl) patch.avatar_url = avatarUrl
    if (Object.keys(patch).length > 0) sync = patch
  }

  // Onboarding minimum (product rule): LinkedIn identity + bio + looking for +
  // offering. hasLinkedinIdentity is inherently true on an OIDC callback
  // (server-verified). The phantom profileIdea requirement was removed (P0-08)
  // — every flag now reads a real persisted profile field, and the callback's
  // inputs are identical to the action layer's so they can never disagree.
  const onboardingInputs: OnboardingInputs = {
    hasLinkedinIdentity: true,
    hasBio: !isEmpty(profile?.bio),
    hasLookingFor: (profile?.lookingFor.roles.length ?? 0) > 0,
    hasOffering: (profile?.offering.categories.length ?? 0) > 0,
  }

  const state = computeOnboardingState(onboardingInputs)
  const fallback = state.isOnboarded
    ? POST_LOGIN_ROUTE
    : '/dashboard/profile/edit'
  const redirectTo = decideRedirect(fallback) ? fallback : POST_LOGIN_ROUTE

  return { create, sync, onboardingInputs, redirectTo, isNewProfile }
}
