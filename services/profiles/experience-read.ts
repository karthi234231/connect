// src/services/profiles/experience-read.ts
// Session 11 — read provider work-experience rows and map them into the
// canonical `ProfileExperienceItem` slot.
//
// The `profile_experiences` table is an S07 addition and does NOT exist in
// `src/types/database.ts` yet. Per the Session 11 seam, this module binds to a
// local typed row interface and casts the client/query result through
// `unknown` — it compiles today and runs the moment S07's migration lands.
//
// The view must never crash because experience is missing: fetch errors and
// empty tables both resolve to `[]`.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ProfileExperienceItem } from './projection'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Local contract for the S07 `profile_experiences` table row. */
export interface ExperienceRow {
  id: string
  user_id: string
  source: string | null
  provider_external_id: string | null
  company: string | null
  company_logo_url?: string | null
  title: string
  description?: string | null
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
export function mapExperienceRow(row: ExperienceRow): ProfileExperienceItem {
  const isCurrent = row.is_current === true
  return {
    id: row.id,
    title: row.title,
    company: row.company ?? null,
    startedAt: toIsoMonth(row.started_at),
    endedAt: isCurrent ? null : toIsoMonth(row.ended_at),
    isCurrent,
    providerOrigin: (row.source ?? PROVIDER_SOURCE) === PROVIDER_SOURCE,
    description: row.description ?? null,
    logoUrl: row.company_logo_url ?? null,
  }
}

/**
 * Fetch a user's provider experiences, ordered by `sort_order`.
 * Never throws: any error (table missing, RLS, network) degrades to `[]`.
 */
export async function fetchProfileExperiences(
  userId: string,
): Promise<ProfileExperienceItem[]> {
  try {
    // The typed client does not know `profile_experiences` yet → cast the whole
    // client through unknown so the .from() chain compiles against current types.
    const supabase =
      (await createServerSupabaseClient()) as unknown as SupabaseClient
    const { data, error } = await supabase
      .from('profile_experiences')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) return []
    return ((data ?? []) as unknown as ExperienceRow[]).map(mapExperienceRow)
  } catch {
    return []
  }
}
