// src/features/events/factories/event-organizer.factory.ts
// Factory entry point for organizer authorization. Async by contract — the
// API routes destructure `const { service } = await createEventOrganizerServices()`.

import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { EventOrganizerService } from '../services/event-organizer.service'

export async function createEventOrganizerServices(): Promise<{
  service: EventOrganizerService
}> {
  const supabase = getAdminSupabaseClient()

  return {
    service: new EventOrganizerService(supabase),
  }
}
