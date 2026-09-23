// src/client/api/public-profile.ts
// Client wrapper for the canonical public-profile read (P0-14).
import { getPublicProfileAction } from '@/app/actions/public-profile'
import type { ProfileProjection } from '@/services/profiles/projection'

export type PublicProfile = ProfileProjection

/**
 * Read another member's PUBLIC profile projection. Returns null when the
 * profile is hidden (private, suspended, deactivated, or blocked) — never the
 * caller's own profile, never a raw row.
 */
export async function fetchPublicProfile(
  userId: string,
): Promise<PublicProfile | null> {
  return getPublicProfileAction({ userId })
}
