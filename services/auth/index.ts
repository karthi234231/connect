import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { POST_LOGIN_ROUTE } from '@/lib/auth-redirect'
import { isSafeRedirectUrl } from '@/lib/security'
import { decideProvisioning, type AuthUserLike } from './provisioning'
import { rowToProfile, type Profile } from '@/services/profiles/mappers'

/**
 * Server-side provisioning: one profile read, atomic create (ignoreDuplicates
 * → never duplicates under concurrent callbacks), optional empty-field sync,
 * and the redirect intent for the callback route.
 */
export async function provisionAndRoute(
  supabase: SupabaseClient,
  user: AuthUserLike,
  requestedNext: string,
): Promise<{ redirectTo: string; isNewProfile: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error

  const profile: Profile | null = data ? rowToProfile(data) : null
  const decision = decideProvisioning(user, profile)

  if (decision.create) {
    // ignoreDuplicates on the PK = atomic create-or-nothing (gate: no duplicates).
    const { error: insertError } = await supabase
      .from('profiles')
      .upsert(decision.create, { onConflict: 'id', ignoreDuplicates: true })
    if (insertError) throw insertError
    logger.info('Profile provisioned', { userId: user.id })
  } else if (decision.sync) {
    const { error: syncError } = await supabase
      .from('profiles')
      .update(decision.sync)
      .eq('id', user.id)
    if (syncError) throw syncError
    logger.debug('Provider fields backfilled into empty profile fields', {
      userId: user.id,
    })
  }

  // Onboarded users may honor their requested deep-link; pending users are
  // always routed to profile completion. Unsafe values fall back server-side.
  // POST_LOGIN_ROUTE is only the default when no safe deep-link was requested.
  let redirectTo = decision.redirectTo
  if (
    redirectTo === POST_LOGIN_ROUTE &&
    requestedNext &&
    requestedNext !== POST_LOGIN_ROUTE &&
    isSafeRedirectUrl(requestedNext)
  ) {
    redirectTo = requestedNext
  }
  return { redirectTo, isNewProfile: decision.isNewProfile }
}

// S10 — canonical capability resolver + guard. UI and server both consume these
// so capability semantics never fork; server/RLS enforcement stays authoritative.
export {
  can,
  capabilitiesFor,
  effectiveCapabilities,
  ensureCapability,
  resolveAuthTier,
  resolveTierFromProfile,
  type AuthTier,
  type Capability,
  type CapabilityDenial,
  type ProfileTierSource,
  type TierInputs,
} from './capabilities'
