import type { ProfileDraft, ProfileSummary } from '@/types/profile'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import { updateProfileAction } from '@/app/actions/profiles'
import { fetchPublicProfile } from '@/client/api/public-profile'

function toSummary(
  row: Awaited<ReturnType<typeof getOwnProfileAction>>,
): ProfileSummary | null {
  if (!row) return null
  return {
    id: row.id,
    full_name: row.fullName,
    avatar_url: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    city: row.city,
    role: (row.role === '' ? 'other' : row.role) as ProfileSummary['role'],
    skills: row.skills,
    headline: row.headline ?? null,
  }
}

export async function fetchOwnProfile(): Promise<ProfileSummary | null> {
  return toSummary(await getOwnProfileAction())
}

// P0-14: this reads the given user's PUBLIC projection — it must NEVER return
// the caller's own profile for an arbitrary id. Returns null when the target is
// hidden (private/suspended/deactivated/blocked) or not a valid id. For the
// caller's own profile use `fetchOwnProfile()`.
export async function fetchProfile(
  userId: string,
): Promise<ProfileSummary | null> {
  const projected = await fetchPublicProfile(userId)
  if (!projected) return null
  return {
    id: projected.identity.id,
    full_name: projected.identity.fullName,
    avatar_url: projected.identity.avatarUrl,
    bio: projected.bio,
    city: projected.city,
    role: (projected.currentRole ?? 'other') as ProfileSummary['role'],
    skills: projected.skills,
    headline: projected.headline,
  }
}

export async function updateProfile(
  input: ProfileDraft,
): Promise<ProfileSummary | null> {
  // S08 gate: only user-owned fields are modelled; provider identity keys
  // (full_name/role/avatar_url) are stripped before the write.
  const result = await updateProfileAction({
    ...(typeof input.bio === 'string' ? { bio: input.bio } : {}),
    ...(input.skills !== undefined ? { skills: input.skills } : {}),
    ...(input.availability !== undefined
      ? {
          availability: input.availability as Parameters<
            typeof updateProfileAction
          >[0]['availability'],
        }
      : {}),
    ...(typeof input.timezone === 'string' ? { timezone: input.timezone } : {}),
    ...(input.looking_for !== undefined
      ? {
          lookingFor: input.looking_for as Parameters<
            typeof updateProfileAction
          >[0]['lookingFor'],
        }
      : {}),
    ...(input.offering !== undefined
      ? {
          offering: input.offering as Parameters<
            typeof updateProfileAction
          >[0]['offering'],
        }
      : {}),
  })
  if (!result.ok) throw new Error(result.error)
  return fetchOwnProfile()
}
