import { getTractionMetricsAction } from '@/app/actions/traction'
import type { TractionMetrics } from '@/services/metrics/service'

export type { TractionMetrics }

/** Traction console aggregates (admin-gated server action). */
export async function fetchTractionMetrics(): Promise<TractionMetrics> {
  return getTractionMetricsAction()
}
