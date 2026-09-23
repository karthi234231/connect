// src/services/alerts/index.ts
export { AlertsService, getAlertsService } from './alerts.service'
export { createAlertsRepository } from './alerts.repository'
export type { AlertsRepository } from './alerts.repository'
export {
  ALERT_SEVERITIES,
  SEVERITY_POLICY,
  type Alert,
  type AlertInsert,
  type AlertSeverity,
  type AlertSource,
  type CreateAlertInput,
  type SeverityPolicy,
} from './alerts.types'
