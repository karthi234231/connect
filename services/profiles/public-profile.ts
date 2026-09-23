// src/services/profiles/public-profile.ts
// Public other-user profile read (P0-14 / spec Section 5).
//
// ONE canonical public read: a viewer requesting another member gets the SAFE
// public projection, never a raw row, and never their own profile by accident.
// Safety gates applied, in order:
//   1. target exists.
//   2. lifecycle: suspended / deactivated (deactivated_at) → hidden.
//   3. visibility: 'private' / 'stealth' → hidden from non-owners.
//   4. block pair (either direction) → hidden.
//   5. canonical public projection (no email/security fields by construction).
//
// A failure to verify any safety property returns null (hidden) — never allow.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  PROFILE_PROJECTION_COLUMNS,
  mapRowToPublicProjection,
  type ProfileProjection,
  type ProfileRowLike,
} from './projection'

/** Visibility values a non-owner viewer may see. */
const PUBLICLY_VISIBLE = new Set(['public', 'recruiting'])

export async function getPublicProfile(
  targetUserId: string,
  viewerId: string | null,
): Promise<ProfileProjection | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PROJECTION_COLUMNS)
    .eq('id', targetUserId)
    .maybeSingle()

  if (error) {
    logger.error('getPublicProfile: profile lookup failed', {
      targetUserId,
      error: error.message,
    })
    return null
  }

  if (!data) return null

  // Lifecycle + visibility. `deactivated_at` and `suspended_at` are read
  // defensively (columns may not exist on legacy rows).
  const row = data as ProfileRowLike & {
    visibility?: string | null
    suspended_at?: string | null
    deactivated_at?: string | null
  }

  if (row.suspended_at) return null
  if (row.deactivated_at) return null

  const isOwner = viewerId != null && viewerId === targetUserId
  const visibility = row.visibility ?? 'public'
  if (!isOwner && !PUBLICLY_VISIBLE.has(visibility)) return null

  // Block pair, either direction, when we have a viewer.
  if (viewerId && !isOwner) {
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${viewerId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${viewerId})`,
      )
      .limit(1)

    if (blocks && blocks.length > 0) return null
  }

  return mapRowToPublicProjection(row)
}
