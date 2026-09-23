// src/client/api/event-attendees.ts
// Organizer attendee roster export + roster read helpers.
import { eventAttendeesExportPath } from '@/config/routes'

/** Download the roster CSV for an owned event (browser-side file download). */
export async function exportEventAttendeesCsv(
  eventId: string,
): Promise<string> {
  const response = await fetch(eventAttendeesExportPath(eventId), {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Attendee export failed with status ${response.status}`)
  }
  return response.text()
}

/** Trigger a browser download for the roster CSV. */
export async function downloadEventAttendeesCsv(
  eventId: string,
): Promise<void> {
  const csv = await exportEventAttendeesCsv(eventId)
  if (typeof document === 'undefined') return

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `event-${eventId}-attendees.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
