import type { Tables } from '@/types/database'
import type { EventBrief } from '@/types/event'
import type { ProfileSummaryDTO } from '@/lib/dto'

import { ROUTES } from '@/config/routes'
import { apiFetch, buildQuery } from '@/client/api/http'

export type SearchType = 'all' | 'people' | 'ideas' | 'events'

export interface SearchOptions {
  type?: SearchType
  limit?: number
}

export type SearchIdeaBrief = Pick<
  Tables<'ideas'>,
  'id' | 'title' | 'stage' | 'owner_id'
>

export interface SearchResponse {
  query: string
  people: ProfileSummaryDTO[]
  ideas: SearchIdeaBrief[]
  events: EventBrief[]
}

function searchUrl(query: string, options: SearchOptions = {}): string {
  const { type = 'all', limit } = options
  return `${ROUTES.api.search}${buildQuery({ q: query, type, limit })}`
}

async function fetchSearch(
  query: string,
  type: SearchType,
  options?: Pick<SearchOptions, 'limit'>,
): Promise<SearchResponse> {
  const payload = await apiFetch<{ data: SearchResponse }>(
    searchUrl(query, { type, ...options }),
  )
  return payload.data
}

export async function searchAll(
  query: string,
  options?: Pick<SearchOptions, 'limit'>,
): Promise<SearchResponse> {
  return fetchSearch(query, 'all', options)
}

export async function searchPeople(
  query: string,
  options?: Pick<SearchOptions, 'limit'>,
): Promise<ProfileSummaryDTO[]> {
  const result = await fetchSearch(query, 'people', options)
  return result.people
}

export async function searchIdeas(
  query: string,
  options?: Pick<SearchOptions, 'limit'>,
): Promise<SearchIdeaBrief[]> {
  const result = await fetchSearch(query, 'ideas', options)
  return result.ideas
}

export async function searchEvents(
  query: string,
  options?: Pick<SearchOptions, 'limit'>,
): Promise<EventBrief[]> {
  const result = await fetchSearch(query, 'events', options)
  return result.events
}
