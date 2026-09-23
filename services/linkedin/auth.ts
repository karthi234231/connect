// src/services/linkedin/auth.ts
// Which auth artifacts we hold after sign-in, extracted from the Supabase
// session identity. Pure helpers: access-token carrier, provider member id
// extraction, declared-scope reconciliation and capability resolution against
// the approved matrix.
import { LINKEDIN_OIDC_PROVIDER } from '@/lib/oauth'
import {
  NO_PROVIDER_DATA_SUPPLY,
  PRODUCT_AUTHORIZED_SCOPES,
  RECONCILABLE_SCOPES,
  resolveCapabilities,
  type ProviderDataSupply,
} from './capabilities'
import type { AccessTokenProvider } from './client'
import type { ProviderCapabilities } from './types'

export interface LinkedInSessionProviderIdentity {
  provider?: string | null
  id?: string | null
  identity_data?: Record<string, unknown> | null
}

export interface LinkedInAuthUserLike {
  id: string
  app_metadata?: { provider?: string } | null
  identities?: ReadonlyArray<LinkedInSessionProviderIdentity> | null
}

export function extractProviderAccessToken(session: {
  provider_token?: string | null
}): string | null {
  return typeof session.provider_token === 'string' &&
    session.provider_token.trim().length > 0
    ? session.provider_token
    : null
}

/** Access-token carrier backed by a session's provider_token (never persisted). */
export function sessionAccessTokenProvider(session: {
  provider_token?: string | null
}): AccessTokenProvider {
  return {
    async getAccessToken(): Promise<string | null> {
      return extractProviderAccessToken(session)
    },
  }
}

export function extractProviderMemberId(
  user: LinkedInAuthUserLike,
  provider: string = LINKEDIN_OIDC_PROVIDER,
): string | null {
  const identity = user.identities?.find((i) => i.provider === provider)
  const memberId = identity?.id
  return typeof memberId === 'string' && memberId.trim().length > 0
    ? memberId
    : null
}

function declaredScopes(
  identityData: Record<string, unknown> | null | undefined,
): string[] {
  const raw = identityData?.scope ?? identityData?.scopes
  return typeof raw === 'string' ? raw.split(/\s+/).filter(Boolean) : []
}

export function grantedScopesFor(user: LinkedInAuthUserLike): string[] {
  const declared =
    user.identities?.flatMap((i) => declaredScopes(i.identity_data)) ?? []
  const base = declared.length > 0 ? declared : PRODUCT_AUTHORIZED_SCOPES
  const known = new Set<string>(RECONCILABLE_SCOPES)
  // Only scopes the adapter knows how to honor may become capabilities.
  return base.filter((scope) => known.has(scope))
}

export function capabilitiesForSession(
  user: LinkedInAuthUserLike,
  supply: ProviderDataSupply = NO_PROVIDER_DATA_SUPPLY,
): ProviderCapabilities {
  return resolveCapabilities(grantedScopesFor(user), supply)
}
