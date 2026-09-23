import type { Tables } from '@/types/database'

export type EventRow = Tables<'events'>

export interface EventVenue {
  name?: string
  address?: string
  city?: string
  region?: string
  country?: string
  lat?: number
  lng?: number
}

export type EventCardData = Pick<
  EventRow,
  | 'id'
  | 'title'
  | 'starts_at'
  | 'timezone'
  | 'location_or_link'
  | 'format'
  | 'type'
  | 'category'
  | 'capacity'
  | 'price'
  | 'cover_image'
  | 'organizer_id'
> & {
  attendeeCount?: number
}

export type EventBrief = Pick<
  EventRow,
  'id' | 'title' | 'starts_at' | 'timezone' | 'location_or_link' | 'format'
>
