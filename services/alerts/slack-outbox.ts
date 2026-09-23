// src/services/alerts/slack-outbox.ts
// HOST-ASYNC-03 / finding #225 — Slack alerts are external side effects and
// must not be fired inline from a domain transaction. Producers enqueue a
// row (idempotent via dedupe_key); the queue worker drains it with the same
// claim/lease + bounded-retry contract as notification_deliveries.
import { logger } from '@/lib/logger'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Tables } from '@/types/database'

export const SLACK_ALERT_MAX_ATTEMPTS = 5

/** Same lease contract as notification deliveries (HOST-ASYNC-01). */
export const SLACK_ALERT_LEASE_MS = 5 * 60 * 1000

/**
 * Row contract handed to the send/mark helpers and to callers of the claim
 * query. Derived from `Tables<'slack_alerts'>` (types/database.ts) so the row
 * type and the SELECT list below cannot drift apart.
 */
export type SlackAlertRecord = Pick<
  Tables<'slack_alerts'>,
  | 'id'
  | 'dedupe_key'
  | 'text'
  | 'status'
  | 'attempts'
  | 'last_error'
  | 'next_attempt_at'
  | 'updated_at'
>

/** Column list for the claim queries — mirrors SlackAlertRecord exactly. */
const FIELDS =
  'id,dedupe_key,text,status,attempts,last_error,next_attempt_at,updated_at'

type AdminClient = NonNullable<ReturnType<typeof getAdminSupabaseClient>>

// slack_alerts is a typed table in Database (migration
// 20260921000000_schema_type_alignment.sql), so this builder is fully checked:
// column names, Insert/Update shapes and the selected-row type all come from
// the schema instead of a hand-maintained untyped facade.
function tbl(client: AdminClient) {
  return client.from('slack_alerts')
}

/**
 * Enqueue a Slack alert. `dedupeKey` collapses repeated intents (e.g. one
 * alert per report id) to a single row — insert conflict on the unique key
 * returns the existing row instead of failing.
 */
export async function enqueueSlackAlert(params: {
  text: string
  dedupeKey?: string
  client?: AdminClient
}): Promise<void> {
  const client = params.client ?? getAdminSupabaseClient()
  if (!client) {
    logger.warn('Slack outbox: admin client unavailable; alert dropped', {
      dedupeKey: params.dedupeKey ?? null,
    })
    return
  }

  const { error } = await tbl(client)
    .insert({
      dedupe_key: params.dedupeKey ?? null,
      text: params.text,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) {
    // 23505 = dedupe key already enqueued; that is success for the caller.
    if (error.code === '23505') return
    throw error
  }
}

export async function claimDueSlackAlerts(
  client: AdminClient,
  limit = 20,
): Promise<SlackAlertRecord[]> {
  const now = new Date()
  const staleProcessingSince = new Date(
    now.getTime() - SLACK_ALERT_LEASE_MS,
  ).toISOString()

  const idle = await tbl(client)
    .select(FIELDS)
    .in('status', ['pending', 'retry_wait'])
    .lte('next_attempt_at', now.toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit)
  if (idle.error) throw idle.error

  const remaining = Math.max(
    0,
    limit - ((idle.data as SlackAlertRecord[] | null)?.length ?? 0),
  )
  const stale =
    remaining > 0
      ? await tbl(client)
          .select(FIELDS)
          .eq('status', 'processing')
          .lt('updated_at', staleProcessingSince)
          .order('updated_at', { ascending: true })
          .limit(remaining)
      : { data: [], error: null }
  if (stale.error) throw stale.error

  return [
    ...((idle.data as SlackAlertRecord[] | null) ?? []),
    ...((stale.data as SlackAlertRecord[] | null) ?? []),
  ]
}

export async function markSlackAlertProcessing(
  client: AdminClient,
  id: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const idle = await tbl(client)
    .update({ status: 'processing', updated_at: nowIso })
    .in('status', ['pending', 'retry_wait'])
    .eq('id', id)
    .select('id')
    .single()
  if (idle.data) return true

  const staleProcessingSince = new Date(
    Date.now() - SLACK_ALERT_LEASE_MS,
  ).toISOString()
  const stale = await tbl(client)
    .update({ status: 'processing', updated_at: nowIso })
    .eq('status', 'processing')
    .lt('updated_at', staleProcessingSince)
    .eq('id', id)
    .select('id')
    .single()
  return Boolean(stale.data)
}

export async function markSlackAlertSent(
  client: AdminClient,
  id: string,
): Promise<void> {
  const { error } = await tbl(client)
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markSlackAlertFailed(
  client: AdminClient,
  id: string,
  error: string,
  attempts: number,
): Promise<void> {
  const next = attempts >= SLACK_ALERT_MAX_ATTEMPTS ? 'failed' : 'retry_wait'
  const backoffMs = Math.min(30_000, 2 ** attempts * 1000)
  const { error: upErr } = await tbl(client)
    .update({
      status: next,
      last_error: error,
      attempts,
      next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (upErr) throw upErr
}

async function postToSlack(
  url: string,
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { sent: false, error: `Slack webhook HTTP ${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Drain due Slack alerts. Called by the authenticated queue worker route
 * (`task: "slack-alerts"`), never inline from a request path.
 */
export async function processSlackAlerts(
  limit = 20,
  client: AdminClient = getAdminSupabaseClient()!,
): Promise<{ processed: number; sent: number; failed: number }> {
  const due = await claimDueSlackAlerts(client, limit)
  let sent = 0
  let failed = 0
  let processed = 0
  const slackUrl = process.env.SLACK_WEBHOOK_URL

  for (const alert of due) {
    const claimed = await markSlackAlertProcessing(client, alert.id)
    if (!claimed) continue // another worker owns this row
    processed += 1

    if (!slackUrl) {
      // Not configured: fail terminally so the row is visible, not retried.
      await markSlackAlertFailed(
        client,
        alert.id,
        'Slack webhook not configured',
        SLACK_ALERT_MAX_ATTEMPTS,
      )
      failed += 1
      continue
    }

    const result = await postToSlack(slackUrl, alert.text)
    if (result.sent) {
      await markSlackAlertSent(client, alert.id)
      sent += 1
    } else {
      await markSlackAlertFailed(
        client,
        alert.id,
        result.error ?? 'Slack send failed',
        alert.attempts + 1,
      )
      failed += 1
    }
  }

  logger.info('Slack alert drain complete', { processed, sent, failed })
  return { processed, sent, failed }
}
