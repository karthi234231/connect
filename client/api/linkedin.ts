// client/api/linkedin.ts
// Client boundary for the LinkedIn provider sync/disconnect machine endpoints
// (A4: client fetch for POST/DELETE routes). Both routes are authed via the
// session cookie; responses are `{ data: {} }` on success and
// `{ error: { code, message } }` on failure.

import { ApiError, apiFetch } from '@/client/api/http'
import { ROUTES } from '@/config/routes'

/** Surface a canned message from an apiFetch failure, else a generic line. */
function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: { message?: string } } | null
    if (typeof body?.error?.message === 'string' && body.error.message) {
      return body.error.message
    }
  }
  return 'That did not work. Please try again.'
}

/** POST /api/linkedin/sync — re-run the provider sync for the signed-in user. */
export async function resyncLinkedIn(): Promise<void> {
  await apiFetch<{ data: Record<string, never> }>(ROUTES.api.linkedinSync, {
    method: 'POST',
  })
}

/** DELETE /api/linkedin/disconnect — GDPR self-service disconnect. */
export async function disconnectLinkedIn(): Promise<void> {
  await apiFetch<{ data: Record<string, never> }>(
    ROUTES.api.linkedinDisconnect,
    { method: 'DELETE' },
  )
}

export { messageFrom }
