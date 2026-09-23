// src/features/events/factories/event-analytics.factory.ts
// Factory entry point for the analytics service. Async by contract — the
// API routes destructure `const { service } = await createEventAnalyticsServices()`.

import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { EventAnalyticsService } from '../services/event-analytics.service'

export async function createEventAnalyticsServices(): Promise<{
  service: EventAnalyticsService
}> {
  const supabase = getAdminSupabaseClient()

  return {
    service: new EventAnalyticsService(supabase),
  }
}
