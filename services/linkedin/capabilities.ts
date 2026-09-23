// src/services/linkedin/capabilities.ts
// Truthfulness rule (§1.1): LinkedIn OIDC proves identity only. Professional
// profile data (headline) is returned only by the classic v2 `r_basicprofile`
// scope — `r_liteprofile` provides just id / firstName / lastName / picture.
// Location display (geoLocation) and the full employment/education history are
// never derivable from any sign-in scope; they are present in the adapter only
// when an approved cache supplies them.
//
// This module also owns the requested-scope contract: the app asks the OAuth
// provider for the scopes in `LINKEDIN_OAUTH_SCOPES` (server-only env, parsed
// here), defaulting to the identity-only set and never letting a config typo
// break identity sign-in.
import { DEFAULT_LINKEDIN_OAUTH_SCOPES } from '@/lib/oauth'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import type { LinkedInCapability, ProviderCapabilities } from './types'

/**
 * Product-authorized LinkedIn OIDC scopes (identity claims only). Canonical
 * list lives in lib/oauth.ts (single source shared with the browser default).
 */
export const PRODUCT_AUTHORIZED_SCOPES = DEFAULT_LINKEDIN_OAUTH_SCOPES

/**
 * Classic v2 scope that ACTUALLY returns headline alongside id / first name /
 * last name / picture (LinkedIn Basic Profile Fields). `r_liteprofile` — the
 * common "profile" grant — does NOT include headline or location.
 */
export const LINKEDIN_PROFILE_SCOPE = 'r_basicprofile'

/** Scope names the adapter will reconcile from a session's declared grants. */
export const RECONCILABLE_SCOPES = [
  ...PRODUCT_AUTHORIZED_SCOPES,
  LINKEDIN_PROFILE_SCOPE,
] as const

/**
 * Classic v2 profile scopes a deploy operator may name in
 * `LINKEDIN_OAUTH_SCOPES` but which the adapter does NOT reconcile into
 * capabilities (they are separate, approval-gated LinkedIn products — only
 * `r_basicprofile` maps to the profile capability).
 */
export const LEGACY_LINKEDIN_SCOPES = [
  'r_liteprofile',
  'r_fullprofile',
] as const

/** Every LinkedIn scope `LINKEDIN_OAUTH_SCOPES` may legitimately name. */
export const KNOWN_OAUTH_SCOPES = [
  ...RECONCILABLE_SCOPES,
  ...LEGACY_LINKEDIN_SCOPES,
] as const

/**
 * Resolve the OAuth scopes the app requests on sign-in. Reads the server-only
 * `LINKEDIN_OAUTH_SCOPES` env var (space-separated, optional) and validates
 * every token against `KNOWN_OAUTH_SCOPES`. An unknown token is a config typo:
 * log it loudly but never break identity sign-in — fall back to the
 * identity-only default set.
 */
export function parseLinkedInOAuthScopes(): string[] {
  const raw = env.LINKEDIN_OAUTH_SCOPES
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [...PRODUCT_AUTHORIZED_SCOPES]
  }
  const requested = raw.split(/\s+/).filter(Boolean)
  const known = new Set<string>(KNOWN_OAUTH_SCOPES)
  const invalid = requested.filter((scope) => !known.has(scope))
  if (invalid.length > 0) {
    logger.warn(
      '[linkedin/capabilities] LINKEDIN_OAUTH_SCOPES contains unknown scope(s); falling back to identity-only scopes',
      { invalid, configured: requested },
    )
    return [...PRODUCT_AUTHORIZED_SCOPES]
  }
  return requested
}

export interface ProviderDataSupply {
  experience: boolean
  education: boolean
}

export const NO_PROVIDER_DATA_SUPPLY: ProviderDataSupply = Object.freeze({
  experience: false,
  education: false,
})

export function resolveCapabilities(
  approvedScopes: readonly string[],
  supply: ProviderDataSupply = NO_PROVIDER_DATA_SUPPLY,
): ProviderCapabilities {
  const granted = new Set(approvedScopes)
  return Object.freeze({
    // OIDC identity is always authorized once a session exists.
    identity: true,
    profile: granted.has(LINKEDIN_PROFILE_SCOPE),
    experience: supply.experience === true,
    education: supply.education === true,
  })
}

export function hasCapability(
  capabilities: ProviderCapabilities,
  capability: LinkedInCapability,
): boolean {
  return capabilities[capability] === true
}
