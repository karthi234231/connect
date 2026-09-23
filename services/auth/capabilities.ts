// src/services/auth/capabilities.ts
// S10 — Centralized capability system: the ONE canonical resolver shared by
// UI gates and server mutations. Server enforcement stays authoritative —
// UI checks are only a rendering convenience.
//
// Tiers (product rule):
//   GUEST        — not signed in. May view public content only.
//   AUTH_PENDING — signed in via LinkedIn OIDC, onboarding not completed.
//                  May browse; may NOT take matching/messaging actions.
//   AUTH_READY   — signed in + onboarded. Full member capabilities.
//   FORBIDDEN    — suspended/blocked. Read-only at most; no writes anywhere.
//
// Deliberately NO profile-completion coupling: completeness gates individual
// actions (completeness.ts), while this model gates identity/onboarding state.
// A 30%-complete onboarded user is AUTH_READY; an 80%-complete but
// non-onboarded user is AUTH_PENDING.

import {
  ERROR_CODES,
  getErrorMessage,
  getErrorStatus,
  type ErrorCode,
} from '@/lib/messages'

export type AuthTier = 'GUEST' | 'AUTH_PENDING' | 'AUTH_READY' | 'FORBIDDEN'

/** Every capability the product can gate, one canonical name each. */
export const CAPABILITIES = [
  'viewPublic',
  'browse',
  'viewOwnProfile',
  'editOwnProfile',
  'requestIntro',
  'sendMessage',
  'swipe',
  'rsvpEvent',
  'publishIdea',
  'manageEvents',
  'admin',
] as const

export type Capability = (typeof CAPABILITIES)[number]

type CapabilityMatrix = Record<AuthTier, Readonly<Record<Capability, boolean>>>

function grants(
  ...allowed: Capability[]
): Readonly<Record<Capability, boolean>> {
  const out = {} as Record<Capability, boolean>
  for (const c of CAPABILITIES) out[c] = allowed.includes(c)
  return Object.freeze(out)
}

/**
 * The capability matrix. Single source of truth — UI and server both call
 * `can()`/`capabilitiesFor()`; nothing else may encode tier logic.
 */
export const CAPABILITY_MATRIX: CapabilityMatrix = Object.freeze({
  GUEST: grants('viewPublic', 'browse'),
  AUTH_PENDING: grants(
    'viewPublic',
    'browse',
    'viewOwnProfile',
    'editOwnProfile',
  ),
  AUTH_READY: grants(
    'viewPublic',
    'browse',
    'viewOwnProfile',
    'editOwnProfile',
    'requestIntro',
    'sendMessage',
    'swipe',
    'rsvpEvent',
    'publishIdea',
    'manageEvents',
  ),
  // Suspended users: identity is known but every capability is withheld.
  FORBIDDEN: grants(),
})

/** All capabilities granted to a tier (frozen record). */
export function capabilitiesFor(
  tier: AuthTier,
): Readonly<Record<Capability, boolean>> {
  return CAPABILITY_MATRIX[tier]
}

/** THE canonical check. UI and server must both use this — nothing else. */
export function can(tier: AuthTier, capability: Capability): boolean {
  return CAPABILITY_MATRIX[tier][capability]
}

// ─── Pure tier resolution ─────────────────────────────────────

export interface TierInputs {
  isSignedIn: boolean
  isSuspended: boolean
  isOnboarded: boolean
  /** Admin comes from profiles.app_role (SQL-only), never from client data. */
  isAdmin: boolean
}

/**
 * Deterministic tier resolution. Admin does not bypass FORBIDDEN — a
 * suspended admin is still FORBIDDEN (enforcement lives in RLS/SQL too).
 */
export function resolveAuthTier(inputs: TierInputs): AuthTier {
  if (!inputs.isSignedIn) return 'GUEST'
  if (inputs.isSuspended) return 'FORBIDDEN'
  if (!inputs.isOnboarded) return 'AUTH_PENDING'
  return 'AUTH_READY'
}

/** Effective tier for capability checks: admins inherit ADMIN upgrades only when READY. */
export function effectiveCapabilities(
  inputs: TierInputs,
): Readonly<Record<Capability, boolean>> {
  const tier = resolveAuthTier(inputs)
  const caps = { ...capabilitiesFor(tier) }
  if (inputs.isAdmin && tier === 'AUTH_READY') caps.admin = true
  return Object.freeze(caps)
}

// ─── Server profile resolver ─────────────────────────────────

/**
 * Minimal server-loaded profile fields the tier resolver needs. Structural only
 * (no client data). The safety system owns populating `suspended_at`; until then
 * it stays null, which resolves to a non-suspended (readable) tier.
 */
export interface ProfileTierSource {
  onboarding_status?: 'pending' | 'completed' | null
  app_role?: string | null
  /** DB column is `suspended_at` (timestamp); non-null = suspended. */
  suspended_at?: string | null
}

/**
 * THE single server resolver: derives the auth tier from one profile row.
 * No profile-completion coupling — only identity/onboarding/suspension state,
 * so a 30%-complete onboarded user is AUTH_READY and an 80%-complete
 * non-onboarded user is AUTH_PENDING. A missing profile resolves to GUEST.
 */
export function resolveTierFromProfile(
  profile: ProfileTierSource | null,
): AuthTier {
  if (!profile) return 'GUEST'
  return resolveAuthTier({
    isSignedIn: true,
    isSuspended: profile.suspended_at != null,
    isOnboarded: profile.onboarding_status === 'completed',
    isAdmin: profile.app_role === 'admin',
  })
}

// ─── Canonical denial guard (message source: /lib/messages) ───

export interface CapabilityDenial {
  capability: Capability
  tier: AuthTier
  code: ErrorCode
  status: number
  message: string
}

/**
 * Canonical guard shared by UI and server. Returns a denial carrying the safe,
 * user-facing copy + transport status from the canonical message library when
 * the tier lacks the capability, or `null` when it is granted. This decides;
 * it does NOT replace RLS/mutation-level enforcement — server rules stay
 * authoritative.
 */
export function ensureCapability(
  tier: AuthTier,
  capability: Capability,
): CapabilityDenial | null {
  if (can(tier, capability)) return null
  return {
    capability,
    tier,
    code: ERROR_CODES.CAPABILITY_DENIED,
    status: getErrorStatus(ERROR_CODES.CAPABILITY_DENIED),
    message: getErrorMessage(ERROR_CODES.CAPABILITY_DENIED),
  }
}
