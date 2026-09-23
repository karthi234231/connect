// client/api/settings.ts
// Client boundary for Settings. Read/persist go through the settings server
// actions; GDPR export/erase use the existing POST API routes via apiFetch
// (per A4: client fetch for the machine endpoints).

import {
  deactivateAccountAction,
  getAccountSettingsAction,
  getNotificationSettingsAction,
  getPrivacySettingsAction,
  updateAccountSettingsAction,
  updateNotificationSettingsAction,
  updatePrivacySettingsAction,
  type SettingsActionResult,
} from '@/app/actions/settings'
import type { NotificationToggleFlags } from '@/app/dashboard/settings/notification-model'
import { apiFetch } from '@/client/api/http'
import { ROUTES } from '@/config/routes'

export interface PrivacyFlags {
  public: boolean
  status: boolean
  requests: boolean
}

export interface GdprJobResult {
  requestId: string
  alreadyPending: boolean
}

export async function fetchNotificationSettings(): Promise<{
  flags: NotificationToggleFlags
}> {
  return getNotificationSettingsAction()
}

export async function updateNotificationSettings(
  flags: NotificationToggleFlags,
): Promise<SettingsActionResult> {
  return updateNotificationSettingsAction(flags)
}

export async function fetchPrivacySettings(): Promise<{
  flags: PrivacyFlags
}> {
  return getPrivacySettingsAction()
}

export async function updatePrivacySettings(flags: {
  public?: boolean
  status?: boolean
  requests?: boolean
}): Promise<SettingsActionResult> {
  return updatePrivacySettingsAction(flags)
}

export async function fetchAccountSettings(): Promise<{
  name: string
  email: string | null
}> {
  return getAccountSettingsAction()
}

export async function updateAccountSettings(input: {
  name?: string
  email?: string
}): Promise<SettingsActionResult> {
  return updateAccountSettingsAction(input)
}

export async function deactivateAccount(): Promise<SettingsActionResult> {
  return deactivateAccountAction()
}

/** POST /api/gdpr/export — the export route wraps the job result in apiOk. */
export async function requestDataExport(): Promise<GdprJobResult> {
  const payload = await apiFetch<{ data: GdprJobResult }>(
    ROUTES.api.gdprExport,
    { method: 'POST' },
  )
  return payload.data
}

/** POST /api/gdpr/erase — the erase route returns the job result directly. */
export async function requestErase(): Promise<GdprJobResult> {
  return apiFetch<GdprJobResult>(ROUTES.api.gdprErase, { method: 'POST' })
}
