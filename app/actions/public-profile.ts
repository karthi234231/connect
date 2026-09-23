// src/app/actions/public-profile.ts
// Public-profile read boundary (P0-14). Authenticated callers may read another
// member's public projection; the viewer id is taken from the verified session,
// never the client payload. Returns null when the target is hidden for any
// safety reason — a hidden profile and a missing profile are indistinguishable
// to the caller by design.
'use server'

import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { uuidSchema } from '@/lib/validation'
import { getPublicProfile } from '@/services/profiles/public-profile'
import type { ProfileProjection } from '@/services/profiles/projection'

const inputSchema = z.object({ userId: uuidSchema }).strict()

export async function getPublicProfileAction(input: {
  userId: string
}): Promise<ProfileProjection | null> {
  const viewerId = await requireUser()

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return null

  return getPublicProfile(parsed.data.userId, viewerId)
}
