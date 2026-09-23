// src/services/profiles/education-read.ts
// Session 03 — read/write provider education rows and map them into the
// canonical `ProfileEducationItem` slot. Mirror of experience-read.ts.
//
// The `profile_education` table is typed in `src/types/database.ts` (mirrors
// migration 20260913100000, verified live), so this module uses the typed
// server client directly — no casts.
//
// The view must never crash because education is missing: fetch errors and
// empty tables both resolve to `[]`. Never fabricate provider data.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ProfileEducationItem } from './model'

/** Local contract for the S03 `profile_education` table row. */
export interface EducationRow {
  id: string
  user_id: string
  source: string | null
  provider_external_id: string | null
  school: string | null
  degree: string | null
  field_of_study: string | null
  started_at: string | null
  ended_at: string | null
  is_current: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

const PROVIDER_SOURCE = 'linkedin'

/**
 * Reduce a full `date` (or `YYYY-MM`) string to the projection's ISO-month
 * contract (`YYYY-MM`). Anything malformed becomes null — never invented.
 */
function toIsoMonth(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const year = match[1]
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Pure row → projection item mapping. Deterministic, no side effects. */
export function mapEducationRow(row: EducationRow): ProfileEducationItem {
  const isCurrent = row.is_current === true
  return {
    id: row.id,
    school: row.school ?? '',
    degree: row.degree ?? null,
    fieldOfStudy: row.field_of_study ?? null,
    startedAt: toIsoMonth(row.started_at),
    endedAt: isCurrent ? null : toIsoMonth(row.ended_at),
    isCurrent,
    providerOrigin: (row.source ?? PROVIDER_SOURCE) === PROVIDER_SOURCE,
  }
}

/**
 * Fetch a user's education rows, ordered by `sort_order`.
 * Never throws: any error (table missing, RLS, network) degrades to `[]`.
 */
export async function fetchProfileEducations(
  userId: string,
): Promise<ProfileEducationItem[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('profile_education')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) return []
    return ((data ?? []) as unknown as EducationRow[]).map(mapEducationRow)
  } catch {
    return []
  }
}
