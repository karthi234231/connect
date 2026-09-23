// src/services/notifications/email.ts
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { escapeHtml } from '@/lib/utils'
import type { Notification } from './notifications.types'

function emailFrom(): string {
  // Lazy: module evaluation during `next build` page-data collection must
  // not read env. Resolved per send instead.
  return env.EMAIL_FROM ?? 'Connect <noreply@fellow.works>'
}

const SUBJECTS: Record<string, string> = {
  match_created: 'You have a new match',
  intro_requested: 'Someone wants to connect',
  message_received: 'New message received',
  event_reminder: 'Event reminder',
  event_group_assigned: "You've been assigned to a group",
  event_waitlist_promoted: 'A spot opened up for you at an event',
}

export interface EmailResult {
  sent: boolean
  error?: string
}

function buildHtml(notification: Notification): string {
  const title = escapeHtml(notification.title)
  const body = notification.body
    ? `<p>${escapeHtml(notification.body)}</p>`
    : ''
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="margin:0 0 12px">${title}</h2>
      ${body}
      <p style="margin-top:24px">
        <a href="${env.NEXT_PUBLIC_APP_URL}/dashboard/notifications"
           style="background:#000;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
          View in Connect
        </a>
      </p>
    </div>
  `
}

export async function sendNotificationEmail(
  to: string,
  notification: Notification,
): Promise<EmailResult> {
  if (!env.RESEND_API_KEY) {
    logger.warn('Resend API key not configured; skipping notification email')
    return { sent: false }
  }
  const resend = new Resend(env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from: emailFrom(),
      to,
      subject: SUBJECTS[notification.type] ?? 'Notification',
      html: buildHtml(notification),
    })
    logger.info('Notification email sent', {
      notificationId: notification.id,
      type: notification.type,
    })
    return { sent: true }
  } catch (error) {
    logger.error('Failed to send notification email', {
      notificationId: notification.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
