// src/services/alerts/alerts.types.ts
import type { Database } from '@/types/database'

export type AlertSeverity = Database['public']['Enums']['alert_severity']
export type AlertSource = Database['public']['Enums']['alert_source']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type AlertInsert = Database['public']['Tables']['alerts']['Insert']

export const ALERT_SEVERITIES: AlertSeverity[] = [
  'info',
  'success',
  'warning',
  'critical',
]

/** Deterministic severity policy per pillar: quiet-hours override + persistence. */
export interface SeverityPolicy {
  /** Security alerts bypass quiet hours (must not be silently suppressed). */
  quietHoursOverride: boolean
  /** Critical alerts persist until acknowledged. */
  persistsUntilAcknowledged: boolean
  /** Durable by default (survives reload into the inbox). */
  durable: boolean
}

export const SEVERITY_POLICY: Record<AlertSeverity, SeverityPolicy> = {
  info: {
    quietHoursOverride: false,
    persistsUntilAcknowledged: false,
    durable: true,
  },
  success: {
    quietHoursOverride: false,
    persistsUntilAcknowledged: false,
    durable: true,
  },
  warning: {
    quietHoursOverride: false,
    persistsUntilAcknowledged: false,
    durable: true,
  },
  critical: {
    quietHoursOverride: true,
    persistsUntilAcknowledged: true,
    durable: true,
  },
}

export interface CreateAlertInput {
  userId: string
  severity: AlertSeverity
  source: AlertSource
  title: string
  body?: string
  link?: string
  dedupeKey?: string
  isSecurity?: boolean
  expiresAt?: string
}
