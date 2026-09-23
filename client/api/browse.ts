import type { Tables } from '@/types/database'
import type { EventBrief } from '@/types/event'

import { ROUTES } from '@/config/routes'
import { apiFetch } from '@/client/api/http'

export type IdeaBrief = Pick<
  Tables<'ideas'>,
  | 'id'
  | 'title'
  | 'problem'
  | 'solution'
  | 'ask'
  | 'stage'
  | 'tags'
  | 'team_needed'
  | 'owner_id'
  | 'validation_count'
> & {
  authorName?: string
  authorAvatarUrl?: string | null
}

export interface BrowseResponse {
  ideas: IdeaBrief[]
  events: EventBrief[]
}

export async function fetchBrowse(): Promise<BrowseResponse> {
  return apiFetch<BrowseResponse>(ROUTES.api.browse)
}
