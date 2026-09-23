// src/services/notifications/notification-actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-10 — Actionable notification contract.
//
// Every notification resolves to EXACTLY ONE safe canonical action. The
// resolution is a pure function of authoritative domain state; nothing here
// trusts the notification row's title/body (those may embed private detail)
// or a client-supplied verb. When the referenced entity is stale, deleted,
// blocked or unknown, the notification degrades to the inbox — never to an
// arbitrary or fabricated surface.
//
// Routing invariants:
// - open_chat        → /dashboard/chat/[matchId] (only for an ACTIVE match the
//                      viewer may message — chatTargetMatchId from the shared
//                      people-projection, which already excludes blocked pairs)
// - view_event       → /events/[eventId] (only for a live event)
// - view_connections → /dashboard/connections (only for a still-pending
//                      connection request)
// - inbox            → /dashboard/notifications (fallback, always safe)
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { projectPeople } from '@/services/relationships/people-projection'
import type { Profile } from '@/services/profiles/mappers'
import type { Notification, NotificationType } from './notifications.types'

export type SafeActionKind =
  'open_chat' | 'view_event' | 'view_connections' | 'inbox'

/** Canonical notification destinations (matches the app router). */
export const NOTIFICATION_ROUTES = {
  openChat: (matchId: string) =>
    `/dashboard/chat/${encodeURIComponent(matchId)}`,
  viewEvent: (eventId: string) => `/events/${encodeURIComponent(eventId)}`,
  connections: () => '/dashboard/connections',
  inbox: () => '/dashboard/notifications',
} as const

/**
 * Exactly one canonical action per notification type (V10-BE-10). A type not
 * listed here is impossible per the DB enum; the resolver still degrades it
 * to the inbox defensively.
 */
export const NOTIFICATION_ACTION_MAP: Readonly<
  Record<NotificationType, { action: SafeActionKind }>
> = {
  match_created: { action: 'open_chat' },
  message_received: { action: 'open_chat' },
  intro_requested: { action: 'view_connections' },
  event_reminder: { action: 'view_event' },
  event_group_assigned: { action: 'view_event' },
  event_waitlist_promoted: { action: 'view_event' },
}

// ─── Authoritative domain state ──────────────────────────────────────────────

export type NotificationDomainState =
  | {
      kind: 'match'
      exists: boolean
      matchStatus: string | null
      participants: { user1_id: string; user2_id: string } | null
    }
  | {
      kind: 'event'
      exists: boolean
      eventStatus: string | null
      organizerId: string | null
    }
  | {
      kind: 'connection'
      exists: boolean
      connectionStatus: string | null
      requesterId: string | null
    }

export interface NotificationActor {
  /** Canonical public projection of the actor (null if blocked/deleted). */
  projection: Profile | null
}

export interface ResolveNotificationActionInput {
  notification: Pick<Notification, 'type' | 'entity_type' | 'entity_id'>
  domain: NotificationDomainState | null
  /** null when the actor could not be resolved (blocked / deleted / absent). */
  actor: NotificationActor | null
  /** The active chat matchId validated by people-projection, if any. */
  chatTargetMatchId: string | null
}

export interface ActionableNotificationContext {
  type: NotificationType | '(unknown)'
  /** Static per-type label — never echoes the (potentially private) title/body. */
  subject: string
  /** Machine-readable reason for the chosen action (analytics/diagnostics). */
  reason: string
  safeAction: SafeActionKind
  safeDestination: string
  /** Safe public display context (e.g. public name), never email/contact. */
  publicContext: string | null
  /** 1 when the referenced entity currently exists, 0 when it is gone. */
  stateVersion: number
}

export interface ActionableNotification {
  notification: Notification
  context: ActionableNotificationContext
}

const SUBJECT_BY_TYPE: Readonly<
  Partial<Record<NotificationType, string>> & { '(unknown)': string }
> = {
  match_created: 'New match',
  message_received: 'New message',
  intro_requested: 'Connection request',
  event_reminder: 'Event reminder',
  event_group_assigned: 'Event group',
  '(unknown)': 'Notification',
}

/** Event statuses still worth routing to the event detail surface. */
const ACTIONABLE_EVENT_STATUSES = new Set([
  'published',
  'sold_out',
  'completed',
])

function inboxFallback(
  notification: Pick<Notification, 'type'>,
  reason: string,
  stateVersion: number,
  actor: NotificationActor | null,
): ActionableNotificationContext {
  return {
    type: SUBJECT_BY_TYPE[notification.type]
      ? notification.type
      : ('(unknown)' as const),
    subject: SUBJECT_BY_TYPE[notification.type] ?? SUBJECT_BY_TYPE['(unknown)'],
    reason,
    safeAction: 'inbox',
    safeDestination: NOTIFICATION_ROUTES.inbox(),
    publicContext: actor?.projection?.fullName ?? null,
    stateVersion,
  }
}

function resolveChatAction(
  notification: Pick<Notification, 'type' | 'entity_id'>,
  domain: NotificationDomainState | null,
  actor: NotificationActor | null,
  chatTargetMatchId: string | null,
): ActionableNotificationContext {
  const match = domain?.kind === 'match' ? domain : null

  if (match?.exists !== true || !match.matchStatus || !notification.entity_id) {
    return inboxFallback(notification, 'entity_deleted', 0, actor)
  }

  if (match.matchStatus !== 'active') {
    return inboxFallback(notification, 'match_not_active', 1, actor)
  }
  if (!chatTargetMatchId || chatTargetMatchId !== notification.entity_id) {
    return inboxFallback(notification, 'chat_unavailable', 1, actor)
  }

  return {
    type: notification.type,
    subject: SUBJECT_BY_TYPE[notification.type] ?? SUBJECT_BY_TYPE['(unknown)'],
    reason: 'open_chat',
    safeAction: 'open_chat',
    safeDestination: NOTIFICATION_ROUTES.openChat(notification.entity_id),
    publicContext: actor?.projection?.fullName ?? null,
    stateVersion: 1,
  }
}

function resolveEventAction(
  notification: Pick<Notification, 'type' | 'entity_id'>,
  domain: NotificationDomainState | null,
  actor: NotificationActor | null,
): ActionableNotificationContext {
  const event = domain?.kind === 'event' ? domain : null

  if (event?.exists !== true || !event.eventStatus || !notification.entity_id) {
    return inboxFallback(notification, 'entity_deleted', 0, actor)
  }

  const actionable =
    event.organizerId !== null &&
    ACTIONABLE_EVENT_STATUSES.has(event.eventStatus)

  return {
    type: notification.type,
    subject: SUBJECT_BY_TYPE[notification.type] ?? SUBJECT_BY_TYPE['(unknown)'],
    reason: actionable ? 'open_event' : 'event_not_actionable',
    safeAction: actionable ? 'view_event' : 'inbox',
    safeDestination: actionable
      ? NOTIFICATION_ROUTES.viewEvent(notification.entity_id)
      : NOTIFICATION_ROUTES.inbox(),
    publicContext: actor?.projection?.fullName ?? null,
    stateVersion: 1,
  }
}

function resolveConnectionsAction(
  notification: Pick<Notification, 'type' | 'entity_id'>,
  domain: NotificationDomainState | null,
  actor: NotificationActor | null,
): ActionableNotificationContext {
  const connection = domain?.kind === 'connection' ? domain : null

  if (
    connection?.exists !== true ||
    !connection.connectionStatus ||
    !notification.entity_id
  ) {
    return inboxFallback(notification, 'entity_deleted', 0, actor)
  }

  const actionable = connection.connectionStatus === 'pending'

  return {
    type: notification.type,
    subject: SUBJECT_BY_TYPE[notification.type] ?? SUBJECT_BY_TYPE['(unknown)'],
    reason: actionable ? 'open_connections' : 'request_closed',
    safeAction: actionable ? 'view_connections' : 'inbox',
    safeDestination: actionable
      ? NOTIFICATION_ROUTES.connections()
      : NOTIFICATION_ROUTES.inbox(),
    publicContext: actor?.projection?.fullName ?? null,
    stateVersion: 1,
  }
}

// ─── Pure resolution (unit-tested; no I/O) ───────────────────────────────────

export function resolveNotificationAction(
  input: ResolveNotificationActionInput,
): ActionableNotificationContext {
  const { notification, domain, actor, chatTargetMatchId } = input
  const entry = NOTIFICATION_ACTION_MAP[notification.type]

  if (!entry) {
    return inboxFallback(notification, 'unknown_type', 0, actor)
  }

  switch (entry.action) {
    case 'open_chat':
      return resolveChatAction(notification, domain, actor, chatTargetMatchId)
    case 'view_event':
      return resolveEventAction(notification, domain, actor)
    case 'view_connections':
      return resolveConnectionsAction(notification, domain, actor)
    default:
      return inboxFallback(notification, 'unknown_type', 0, actor)
  }
}

// ─── Batched authoritative reads (no N+1) ────────────────────────────────────

function entityKey(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityType || !entityId) return null
  return `${entityType}:${entityId}`
}

export function buildDomainKey(
  entityType: string | null,
  entityId: string | null,
): string | null {
  return entityKey(entityType, entityId)
}

/**
 * Load authoritative existence/status for every referenced entity in one pass:
 * matches, events, connection_requests — each in a chunked IN query.
 */
export async function loadNotificationDomainState(
  notifications: Pick<Notification, 'entity_type' | 'entity_id'>[],
  client?: SupabaseClient,
): Promise<Map<string, NotificationDomainState>> {
  const supabase = client ?? getAdminSupabaseClient()!
  const result = new Map<string, NotificationDomainState>()

  const matchIds = Array.from(
    new Set(
      notifications
        .filter((n) => n.entity_type === 'match' && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  )
  const eventIds = Array.from(
    new Set(
      notifications
        .filter((n) => n.entity_type === 'event' && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  )
  const connectionIds = Array.from(
    new Set(
      notifications
        .filter((n) => n.entity_type === 'connection_request' && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  )

  if (matchIds.length > 0) {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            in: (
              col: string,
              v: string[],
            ) => Promise<{ data: unknown; error: { message: string } | null }>
          }
        }
      }
    )
      .from('matches')
      .select('id, status, user1_id, user2_id')
      .in('id', matchIds)
    if (error) {
      throw new Error(`Failed to load match domain state: ${error.message}`)
    }
    for (const row of (data ?? []) as Array<{
      id: string
      status: string
      user1_id: string
      user2_id: string
    }>) {
      result.set(`match:${row.id}`, {
        kind: 'match',
        exists: true,
        matchStatus: row.status,
        participants: { user1_id: row.user1_id, user2_id: row.user2_id },
      })
    }
    for (const id of matchIds) {
      if (!result.has(`match:${id}`)) {
        result.set(`match:${id}`, {
          kind: 'match',
          exists: false,
          matchStatus: null,
          participants: null,
        })
      }
    }
  }

  if (eventIds.length > 0) {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            in: (
              col: string,
              v: string[],
            ) => Promise<{ data: unknown; error: { message: string } | null }>
          }
        }
      }
    )
      .from('events')
      .select('id, status, organizer_id')
      .in('id', eventIds)
    if (error) {
      throw new Error(`Failed to load event domain state: ${error.message}`)
    }
    for (const row of (data ?? []) as Array<{
      id: string
      status: string
      organizer_id: string
    }>) {
      result.set(`event:${row.id}`, {
        kind: 'event',
        exists: true,
        eventStatus: row.status,
        organizerId: row.organizer_id,
      })
    }
    for (const id of eventIds) {
      if (!result.has(`event:${id}`)) {
        result.set(`event:${id}`, {
          kind: 'event',
          exists: false,
          eventStatus: null,
          organizerId: null,
        })
      }
    }
  }

  if (connectionIds.length > 0) {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            in: (
              col: string,
              v: string[],
            ) => Promise<{ data: unknown; error: { message: string } | null }>
          }
        }
      }
    )
      .from('connection_requests')
      .select('id, status, requester_id')
      .in('id', connectionIds)
    if (error) {
      throw new Error(
        `Failed to load connection domain state: ${error.message}`,
      )
    }
    for (const row of (data ?? []) as Array<{
      id: string
      status: string
      requester_id: string
    }>) {
      result.set(`connection_request:${row.id}`, {
        kind: 'connection',
        exists: true,
        connectionStatus: row.status,
        requesterId: row.requester_id,
      })
    }
    for (const id of connectionIds) {
      if (!result.has(`connection_request:${id}`)) {
        result.set(`connection_request:${id}`, {
          kind: 'connection',
          exists: false,
          connectionStatus: null,
          requesterId: null,
        })
      }
    }
  }

  return result
}

// ─── Orchestration (wires domain state + people-projection to the resolver) ──

export interface BuildActionableNotificationsDeps {
  loadDomain?: typeof loadNotificationDomainState
  projectPeopleFn?: typeof projectPeople
}

/**
 * Resolve a batch of inbox rows to actionable contexts. The actor + chat
 * target for each row come from the shared people-projection, which already
 * hides blocked/deleted identities. Purely structural — never throws for a
 * malformed row; the row simply degrades.
 */
export async function buildActionableNotifications(
  userId: string,
  rows: Notification[],
  deps: BuildActionableNotificationsDeps = {},
): Promise<ActionableNotification[]> {
  if (rows.length === 0) return []

  const loadDomain = deps.loadDomain ?? loadNotificationDomainState
  const peopleProject = deps.projectPeopleFn ?? projectPeople

  const domainByEntity = await loadDomain(rows)
  if (domainByEntity.size === 0) {
    return rows.map((row) => ({
      notification: row,
      context: resolveNotificationAction({
        notification: row,
        domain: null,
        actor: null,
        chatTargetMatchId: null,
      }),
    }))
  }

  // Collect the actor ids that make sense for these rows.
  const actorIds = new Set<string>()
  for (const row of rows) {
    const domain = domainByEntity.get(
      buildDomainKey(row.entity_type, row.entity_id) ?? '',
    )
    if (!domain) continue
    if (domain.kind === 'match' && domain.participants) {
      const other =
        domain.participants.user1_id === userId
          ? domain.participants.user2_id
          : domain.participants.user1_id
      if (other && other !== userId) actorIds.add(other)
    } else if (domain.kind === 'event' && domain.organizerId) {
      if (domain.organizerId !== userId) actorIds.add(domain.organizerId)
    } else if (domain.kind === 'connection' && domain.requesterId) {
      if (domain.requesterId !== userId) actorIds.add(domain.requesterId)
    }
  }

  const projections =
    actorIds.size > 0 ? await peopleProject(userId, Array.from(actorIds)) : []
  const projectionByUser = new Map(
    projections.map((projection) => [projection.userId, projection]),
  )

  // A validated open-chat target exists only for an active, unblocked match.
  const chatMatchIds = new Set<string>()
  for (const projection of projections) {
    if (projection.chatTargetState?.status === 'active') {
      chatMatchIds.add(projection.chatTargetState.matchId)
    }
  }

  return rows.map((row) => {
    const domain =
      domainByEntity.get(
        buildDomainKey(row.entity_type, row.entity_id) ?? '',
      ) ?? null

    let actor: NotificationActor | null = null
    let chatTargetMatchId: string | null = null

    if (domain) {
      if (domain.kind === 'match' && domain.participants) {
        const other =
          domain.participants.user1_id === userId
            ? domain.participants.user2_id
            : domain.participants.user1_id
        const otherProjection = other ? projectionByUser.get(other) : undefined
        actor = {
          projection: otherProjection?.publicProfileProjection ?? null,
        }
        if (row.entity_id && chatMatchIds.has(row.entity_id)) {
          chatTargetMatchId = row.entity_id
        }
      } else if (domain.kind === 'event' && domain.organizerId) {
        const organizer = projectionByUser.get(domain.organizerId)
        actor = { projection: organizer?.publicProfileProjection ?? null }
      } else if (domain.kind === 'connection' && domain.requesterId) {
        const requester = projectionByUser.get(domain.requesterId)
        actor = { projection: requester?.publicProfileProjection ?? null }
      }
    }

    return {
      notification: row,
      context: resolveNotificationAction({
        notification: row,
        domain,
        actor,
        chatTargetMatchId,
      }),
    }
  })
}
