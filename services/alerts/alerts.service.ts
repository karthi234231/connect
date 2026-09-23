// src/services/alerts/alerts.service.ts
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  createAlertsRepository,
  type AlertsRepository,
} from './alerts.repository'
import {
  SEVERITY_POLICY,
  type Alert,
  type CreateAlertInput,
} from './alerts.types'

export class AlertsService {
  private readonly repo: AlertsRepository

  constructor(repo?: AlertsRepository) {
    this.repo = repo ?? createAlertsRepository(getAdminSupabaseClient()!)
  }

  async listForUser(userId: string, limit = 50): Promise<Alert[]> {
    return this.repo.listForUser(userId, limit)
  }

  async listActiveForUser(userId: string, limit = 20): Promise<Alert[]> {
    return this.repo.listActiveForUser(userId, limit)
  }

  async getUnacknowledgedCount(userId: string): Promise<number> {
    return this.repo.getUnacknowledgedCount(userId)
  }

  async acknowledge(alertId: string, userId: string): Promise<void> {
    await this.repo.acknowledge(alertId, userId)
  }

  /**
   * #124 — central policy gate. Every alert creation flows through here;
   * no path may bypass it. A severity is creatable iff the policy marks it
   * durable (all current severities are; a future non-durable severity is
   * rejected at the boundary instead of silently persisted). Unknown
   * severities fail closed.
   */
  private shouldCreateAlert(severity: CreateAlertInput['severity']): boolean {
    const policy = SEVERITY_POLICY[severity]

    if (!policy) {
      return false // fail closed on unknown severity
    }

    return policy.durable === true
  }

  /**
   * Persist a durable alert whose severity policy is applied deterministically:
   * - critical/security alerts are never suppressed by quiet hours (they are
   *   durable and read on-demand; there is no delivery-time quiet-hours gate on
   *   the alerts store), and
   * - critical alerts persist until acknowledged (critical.always durable; the
   *   open/expiry semantics are enforced by the store partial-unique dedupe and
   *   the read model).
   * Returns the created alert, or null on dedupe/policy rejection.
   */
  async notify(input: CreateAlertInput): Promise<Alert | null> {
    if (!this.shouldCreateAlert(input.severity)) {
      return null
    }

    return this.repo.insert(input)
  }
}

let singleton: AlertsService | null = null

export function getAlertsService(): AlertsService {
  if (!singleton) {
    singleton = new AlertsService()
  }
  return singleton
}
