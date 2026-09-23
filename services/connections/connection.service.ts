// src/services/connections/connection.service.ts
// W3.5 — People Connections (separate from idea join flow).
//
// First-class people-to-people networking: send/accept/decline connection
// requests. An accepted request creates an ACTIVE `matches` row so the pair can
// message (the same thread channel used by matching). Blocked pairs are
// suppressed both at send time and in feeds (filterBlockedCandidates).
//
// Privacy (§7.2): feeds return ProfileSummaryDTO-style public data only; full
// identity/contact is never selected here.
// ─────────────────────────────────────────────────────────────────────────────
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import {
  canSendRequest,
  type ProfileLike,
} from '@/services/profiles/completeness'
import { getProfile } from '@/services/profiles/service'
import {
  areBlocked,
  filterBlockedCandidates,
} from '@/services/safety/safety.service'
import {
  sendConnectionRequestSchema,
  respondConnectionRequestSchema,
  connectionResultSchema,
  toConnectionRequestDTO,
  type SendConnectionRequestInput,
  type RespondConnectionRequestInput,
  type ConnectionRequestDTO,
  type ConnectionRequestRow,
  type ConnectionCounterpart,
} from './connection.schema'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCounterpart(
  _userId: string,
  counterpartId: string,
  matchId: string | null,
): Promise<ConnectionCounterpart | null> {
  // Browse-safe public projection only (no contact / hidden identity).
  const profile = await getPublicCounterpart(counterpartId)
  if (!profile) return null
  return {
    id: profile.id,
    matchId,
    fullName: profile.fullName,
    role: profile.role,
    avatarUrl: profile.avatarUrl,
    headline: profile.headline,
    topSkills: profile.topSkills,
  }
}

async function getPublicCounterpart(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, bio, skills, avatar_url, visibility, last_active_at',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role ?? null,
    avatarUrl: data.avatar_url ?? null,
    headline: data.bio ? data.bio.slice(0, 90) : null,
    topSkills: (data.skills ?? []).slice(0, 3),
  }
}

// ─── Send connection request ─────────────────────────────────────────────────

export interface SendResult {
  requestId: string
  status: 'pending' | 'accepted'
}

export async function sendConnectionRequest(
  requesterId: string,
  input: SendConnectionRequestInput,
): Promise<SendResult> {
  const parsed = sendConnectionRequestSchema.parse(input)
  const { addresseeId, message } = parsed

  if (requesterId === addresseeId) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      'You cannot connect with yourself.',
    )
  }

  // Action gating: connecting is an action that requires a complete-enough profile.
  const profile = await getProfile(requesterId)
  if (!profile || !canSendRequest(profile as ProfileLike)) {
    logger.warn('Connection send gated: incomplete profile', { requesterId })
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Complete your profile before sending a connection request.',
    )
  }

  // Suppress blocked pairs (either direction).
  if (await areBlocked(requesterId, addresseeId)) {
    throw new AppError(
      ErrorCodes.BLOCKED,
      'You cannot send a connection request to this user.',
    )
  }

  const supabase = await createServerSupabaseClient()

  // Idempotency: if an existing pending/accepted request exists, return it.
  const { data: existing, error: existingError } = await supabase
    .from('connection_requests')
    .select('id, status')
    .eq('requester_id', requesterId)
    .eq('addressee_id', addresseeId)
    .maybeSingle()
  if (existingError && existingError.code !== 'PGRST116') {
    logger.error('Connection send: check failed', {
      requesterId,
      addresseeId,
      error: existingError.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to send connection request',
      {
        cause: existingError,
      },
    )
  }
  if (existing) {
    if (existing.status === 'pending' || existing.status === 'accepted') {
      return { requestId: existing.id, status: existing.status }
    }
    // A declined request can be re-sent — update it back to pending.
    const { data: updated, error: updateError } = await supabase
      .from('connection_requests')
      .update({
        status: 'pending',
        message: message ?? null,
        responded_at: null,
      })
      .eq('id', existing.id)
      .eq('requester_id', requesterId)
      .select('id, status')
      .maybeSingle()
    if (updateError || !updated || updated.status !== 'pending') {
      logger.error('Connection send: re-send failed', {
        requesterId,
        addresseeId,
        error: updateError?.message,
      })
      throw new AppError(
        ErrorCodes.INTERNAL,
        'Failed to send connection request',
        {
          cause: updateError,
        },
      )
    }
    return { requestId: updated.id, status: 'pending' }
  }

  const { data, error } = await supabase
    .from('connection_requests')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
      message: message || null,
    })
    .select('id, status')
    .single()
  if (error) {
    if (error.code === '23505') {
      // Race: a row was just created. Fetch it.
      const { data: race } = await supabase
        .from('connection_requests')
        .select('id, status')
        .eq('requester_id', requesterId)
        .eq('addressee_id', addresseeId)
        .maybeSingle()
      if (race && race.status === 'pending') {
        return { requestId: race.id, status: 'pending' }
      }
      if (race) {
        logger.error('Connection send: race row in unexpected state', {
          requesterId,
          addresseeId,
          status: race.status,
        })
      }
      throw new AppError(
        ErrorCodes.CONFLICT,
        'Connection request already exists.',
      )
    }
    logger.error('Connection send: insert failed', {
      requesterId,
      addresseeId,
      error: error.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to send connection request',
      {
        cause: error,
      },
    )
  }

  await trackFunnel({
    // Finding #14 — a pending request is NOT a match; MatchCreated is emitted
    // only on acceptance (below) and on swipe-match (match.service).
    eventName: FunnelEvents.JoinRequested,
    actorId: requesterId,
    entityType: 'connection_request',
    entityId: String(data.id),
    result: 'pending',
  })

  logger.info('Connection request sent', {
    requestId: data.id,
    requesterId,
    addresseeId,
  })
  return { requestId: data.id, status: 'pending' }
}

// ─── Accept / decline ────────────────────────────────────────────────────────

export async function respondConnectionRequest(
  userId: string,
  input: RespondConnectionRequestInput,
): Promise<{ requestId: string; status: 'accepted' | 'declined' }> {
  const parsed = respondConnectionRequestSchema.parse(input)
  const decision = parsed.decision

  const supabase = await createServerSupabaseClient()

  // S02-TODO-B unit 3: one atomic SECURITY DEFINER transaction — conditional
  // pending→accepted/declined by the addressee + canonical idempotent match
  // insert + match_timeline event. Identity comes from auth.uid() inside the
  // RPC; the client-supplied userId is only a mirror for logging.
  const { data: rpc, error } = await supabase.rpc(
    'respond_connection_request',
    {
      p_request_id: parsed.requestId,
      p_decision: decision,
    },
  )

  if (error) {
    logger.error('Connection respond: rpc failed', {
      requestId: parsed.requestId,
      userId,
      error: error.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to respond to connection request',
      { cause: error },
    )
  }

  const result = connectionResultSchema.safeParse(rpc)
  if (!result.success || result.data.ok !== true) {
    const reason = result.success
      ? (result.data.reason ?? 'not_found')
      : 'not_found'
    logger.warn('Connection respond: rejected', {
      requestId: parsed.requestId,
      userId,
      reason,
    })
    throw AppError.notFound('Pending connection request', parsed.requestId)
  }

  const status =
    result.data.status ?? (decision === 'accept' ? 'accepted' : 'declined')

  await trackFunnel({
    eventName:
      status === 'accepted'
        ? FunnelEvents.MatchCreated
        : FunnelEvents.JoinRejected,
    actorId: userId,
    entityType: 'connection_request',
    entityId: parsed.requestId,
    result: status,
  })

  logger.info('Connection request responded', {
    requestId: parsed.requestId,
    userId,
    status,
  })
  return { requestId: parsed.requestId, status }
}

// ─── Lists ───────────────────────────────────────────────────────────────────

export async function listIncomingRequests(
  userId: string,
  status: 'pending' | 'accepted' | 'declined' = 'pending',
): Promise<ConnectionRequestRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('connection_requests')
    .select('id, requester_id, addressee_id, status, message, created_at')
    .eq('addressee_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Connections: list incoming failed', {
      userId,
      error: error.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to load connection requests',
      {
        cause: error,
      },
    )
  }
  return (data ?? []) as ConnectionRequestRow[]
}

export async function listOutgoingRequests(
  userId: string,
  status: 'pending' | 'accepted' | 'declined' = 'pending',
): Promise<ConnectionRequestRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('connection_requests')
    .select('id, requester_id, addressee_id, status, message, created_at')
    .eq('requester_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Connections: list outgoing failed', {
      userId,
      error: error.message,
    })
    throw new AppError(
      ErrorCodes.INTERNAL,
      'Failed to load connection requests',
      {
        cause: error,
      },
    )
  }
  return (data ?? []) as ConnectionRequestRow[]
}

/**
 * Connection feed — incoming + outgoing requests with enrollments hydrated to
 * browse-safe public DTOs, plus the accepted connections list.
 */
export async function getConnectionFeed(userId: string): Promise<{
  incoming: ConnectionRequestDTO[]
  outgoing: ConnectionRequestDTO[]
  connections: ConnectionCounterpart[]
}> {
  const [incoming, outgoing] = await Promise.all([
    listIncomingRequests(userId, 'pending'),
    listOutgoingRequests(userId, 'pending'),
  ])

  // Filter out blocked counterparties (either direction).
  const incomingIds = incoming.map((r) => r.requester_id ?? '')
  const outgoingIds = outgoing.map((r) => r.addressee_id ?? '')
  const allowedIncoming = await filterBlockedCandidates(
    userId,
    incomingIds.map((id) => ({ id })),
  )
  const allowedOutgoing = await filterBlockedCandidates(
    userId,
    outgoingIds.map((id) => ({ id })),
  )
  const allowedIncomingSet = new Set(allowedIncoming.map((c) => c.id))
  const allowedOutgoingSet = new Set(allowedOutgoing.map((c) => c.id))

  const filteredIncoming = incoming.filter((r) =>
    allowedIncomingSet.has(r.requester_id ?? ''),
  )
  const filteredOutgoing = outgoing.filter((r) =>
    allowedOutgoingSet.has(r.addressee_id ?? ''),
  )

  // Accepted connections: derive from matches where user participates & active.
  const supabase = await createServerSupabaseClient()
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id')
    .eq('status', 'active')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

  // Map counterpart profile id → their active match id for direct-thread routing.
  const connectionIds: string[] = []
  const matchByTarget = new Map<string, string>()
  if (!error && matches) {
    for (const m of matches) {
      const other = m.user1_id === userId ? m.user2_id : m.user1_id
      if (other) {
        matchByTarget.set(other, m.id)
        connectionIds.push(other)
      }
    }
  }

  const allowed = await filterBlockedCandidates(
    userId,
    connectionIds.map((id) => ({ id })),
  )
  const acceptedIds = new Set(allowed.map((c) => c.id))

  const connections = await Promise.all(
    [...acceptedIds].map((id) =>
      getCounterpart(userId, id, matchByTarget.get(id) ?? null),
    ),
  )

  const [incomingDTOs, outgoingDTOs] = await Promise.all([
    Promise.all(
      filteredIncoming.map(async (r) =>
        toConnectionRequestDTO(
          r,
          r.requester_id
            ? await getCounterpart(userId, r.requester_id, null)
            : null,
        ),
      ),
    ),
    Promise.all(
      filteredOutgoing.map(async (r) =>
        toConnectionRequestDTO(
          r,
          r.addressee_id
            ? await getCounterpart(userId, r.addressee_id, null)
            : null,
        ),
      ),
    ),
  ])

  return {
    incoming: incomingDTOs,
    outgoing: outgoingDTOs,
    connections: connections.filter(
      (c): c is ConnectionCounterpart => c !== null,
    ),
  }
}

export { toConnectionRequestDTO }
