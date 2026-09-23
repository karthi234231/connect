// src/app/actions/profile-read.ts
// Own-profile read boundary: single source for header/profile pages.
'use server'

import { requireUser } from '@/lib/auth'
import { getProfile } from '@/services/profiles/service'

export type OwnProfileResult = Awaited<ReturnType<typeof getProfile>>

export async function getOwnProfileAction(): Promise<OwnProfileResult> {
  const userId = await requireUser()
  return getProfile(userId)
}
