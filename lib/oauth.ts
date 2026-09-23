// src/lib/oauth.ts
// S05 — LinkedIn OIDC is the single auth provider.
// Client-safe (no server-only imports) so (auth) pages can use it directly.
// The browser only initiates the redirect; identity authority stays with the
// server callback (/callback) — never trust client-side auth state.
//
// POST_LOGIN_ROUTE is the single post-login landing surface (swipe cards).
// Login/callback/proxy fall back to it only when no safe `next` deep-link was
// requested — deep-links are always honored first. Canonical value lives in
// lib/auth-redirect (Edge-safe); this re-export keeps oauth callers on one value.
import type { SupabaseClient } from '@supabase/supabase-js'

import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'

export { POST_LOGIN_ROUTE }

export const LINKEDIN_OIDC_PROVIDER = 'linkedin_oidc' as const

/** All auth surfaces redirect back through /callback (PKCE code exchange). */
export const OAUTH_CALLBACK_PATH = '/callback'

/**
 * Client-safe default LinkedIn OIDC scopes (identity claims only: name + email
 * + photo). This is the canonical default shared by both the server resolver
 * (`parseLinkedInOAuthScopes` in services/linkedin/capabilities.ts) and the
 * browser flow. The server-only `LINKEDIN_OAUTH_SCOPES` env var can extend
 * this list (e.g. `r_basicprofile` once the LinkedIn app is approved for it);
 * the login page resolves the effective list through the `scopesForOAuth`
 * server action and falls back to this constant when the server is unreachable
 * so identity sign-in never depends on an env fetch.
 */
export const DEFAULT_LINKEDIN_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
] as const

/**
 * Initiate the LinkedIn OIDC sign-in/up redirect.
 * Supabase provisions the account on first sign-in, so login and signup share
 * this one entry point.
 */
export async function signInWithLinkedIn(
  client: SupabaseClient,
  next = POST_LOGIN_ROUTE,
): Promise<{ error: Error | null }> {
  const redirectTo = new URL(OAUTH_CALLBACK_PATH, window.location.origin)
  if (next && next !== POST_LOGIN_ROUTE)
    redirectTo.searchParams.set('next', next)
  const { error } = await client.auth.signInWithOAuth({
    provider: LINKEDIN_OIDC_PROVIDER,
    options: {
      redirectTo: redirectTo.toString(),
      skipBrowserRedirect: false,
      scopes: DEFAULT_LINKEDIN_OAUTH_SCOPES.join(' '),
    },
  })
  return { error: error ?? null }
}

/** Map callback/provider error codes to user-safe messages (no internals). */
export function oauthErrorMessage(code: string | null): string {
  switch (code) {
    case 'missing_code':
    case 'oauth_exchange_failed':
    case 'provider_error':
    case 'user_cancelled':
      return "LinkedIn sign-in didn't complete. Please try again."
    default:
      return 'Something went wrong while signing in. Please try again.'
  }
}
