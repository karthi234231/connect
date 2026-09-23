// src/app/actions/traction.ts
// Traction console read boundary. Admin-gated (requireAdmin) so the aggregate
// numbers never leak to a non-admin session; the underlying service is
// best-effort and returns nulls rather than throwing, so this action never
// needs an error envelope.
'use server'

import { requireAdmin } from '@/lib/auth'
import {
  getTractionMetrics,
  type TractionMetrics,
} from '@/services/metrics/service'

export type { TractionMetrics }

export async function getTractionMetricsAction(): Promise<TractionMetrics> {
  await requireAdmin()
  return getTractionMetrics()
}
