// src/services/ideas/idea-people.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-09 — idea → people collaboration context. A published idea's people
// are projected as { publicProfileProjection, relationshipState,
// chatTargetState } cards via the single shared relationship-integration
// helper (src/services/relationships/people-projection).
//
// Privacy (Web plan §7.2 — full identity is approval-gated):
// - Validators / interesters NEVER appear as cards; they surface only as the
//   authoritative `interestCount` aggregate (ideas.validation_count).
// - Non-published ideas 404 for non-owners (existence is not leaked).
// - Guest/anon and pending applicants see no identities, only counts plus the
//   browse-safe owner marker (role-only), exactly like IdeaCardDTO.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import {
  createPeopleProjectionDao,
  projectPeople,
  type PeopleProjection,
  type PeopleProjectionDao,
} from '@/services/relationships/people-projection'

export type IdeaMembershipState = 'owner' | 'member' | 'pending' | 'none'
export type IdeaPersonRole = 'owner' | 'member' | 'applicant'

export interface IdeaPersonCard extends PeopleProjection {
  role: IdeaPersonRole
}

/** Browse-safe owner marker — identical visibility to IdeaCardDTO (§7.2). */
export interface IdeaOwnerMarker {
  id: string
  role: string | null
}

export interface IdeaPeopleContext {
  ideaId: string
  title: string
  visible: boolean
  accessible: boolean
  membershipState: IdeaMembershipState
  canMessageCommunity: boolean
  interestCount: number
  memberCount: number
  joinEnabled: boolean
  owner: IdeaOwnerMarker | null
  people: IdeaPersonCard[]
}

export interface IdeaPeopleDeps {
  client?: SupabaseClient
  dao?: PeopleProjectionDao
}

interface IdeaRow {
  id: string
  owner_id: string
  title: string
  visibility: string
  join_enabled: boolean
  validation_count: number
}

interface MemberRow {
  user_id: string
}

interface JoinRequestRow {
  user_id: string
  status: string
}

export async function getIdeaCollaborationContext(
  ideaId: string,
  viewerId: string | null,
  deps: IdeaPeopleDeps = {},
): Promise<IdeaPeopleContext> {
  const supabase = (deps.client ??
    (await createServerSupabaseClient())) as unknown as SupabaseClient
  const dao = deps.dao ?? createPeopleProjectionDao()

  const { data: ideaRow, error: ideaError } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{
              data: unknown
              error: { code?: string; message: string } | null
            }>
          }
        }
      }
    }
  )
    .from('ideas')
    .select(
      'id, owner_id, title, visibility, join_enabled, validation_count, profiles!ideas_owner_id_fkey(role)',
    )
    .eq('id', ideaId)
    .maybeSingle()

  if (ideaError) {
    if (ideaError.code === 'PGRST116') {
      throw AppError.notFound('Idea', ideaId)
    }
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load idea', {
      cause: ideaError,
    })
  }
  const idea = (ideaRow ?? null) as unknown as IdeaRow | null
  if (!idea) throw AppError.notFound('Idea', ideaId)

  // Flatten the FK role column exactly like idea.service.ts's toIdeaCardDTO.
  const ownerRole =
    (ideaRow as { profiles?: { role?: string | null } } | null)?.profiles
      ?.role ?? null

  const isOwner = Boolean(viewerId) && viewerId === idea.owner_id

  // #121 app-explicit visibility: a non-owner reading a non-published idea
  // gets NOT_FOUND (duplicate of getIdea's RLS-complementing rule).
  if (!isOwner && idea.visibility !== 'published') {
    throw AppError.notFound('Idea', ideaId)
  }

  // Owner-identity gate per role row.
  const { data: membershipRows, error: membershipError } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  )
    .from('team_memberships')
    .select('user_id')
    .eq('idea_id', ideaId)

  if (membershipError) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load idea team', {
      cause: membershipError,
    })
  }
  const members = (membershipRows ?? []) as MemberRow[]

  const { data: joinRows, error: joinError } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  )
    .from('join_requests')
    .select('user_id, status')
    .eq('idea_id', ideaId)

  if (joinError) {
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load join requests', {
      cause: joinError,
    })
  }
  const joinRequests = (joinRows ?? []) as JoinRequestRow[]

  const memberIds = new Set(members.map((m) => m.user_id))
  const isMember = Boolean(viewerId) && memberIds.has(viewerId!)
  const hasPendingJoin = joinRequests.some(
    (request) => request.user_id === viewerId && request.status === 'pending',
  )

  const membershipState: IdeaMembershipState = isOwner
    ? 'owner'
    : isMember
      ? 'member'
      : hasPendingJoin
        ? 'pending'
        : 'none'

  // Every participant counts (owner + members + approved joiners); validators
  // are deliberately NOT members and never count into membership.
  const participantCount =
    memberIds.size + (memberIds.has(idea.owner_id) ? 0 : 1)

  // ── Who is revealed (approval-gated) ────────────────────────────────────
  // - Owner viewer : every member + pending/approved applicant.
  // - Member viewer: owner + other members + approved applicants (community).
  // - Everyone else: nobody (identities hidden), counts only.
  const revealRequired = isOwner || isMember
  if (!revealRequired) {
    return {
      ideaId: idea.id,
      title: idea.title,
      visible: true,
      accessible: true,
      membershipState,
      canMessageCommunity: false,
      interestCount: idea.validation_count ?? 0,
      memberCount: participantCount,
      joinEnabled: idea.join_enabled,
      owner: { id: idea.owner_id, role: ownerRole },
      people: [],
    }
  }

  const roleByUserId = new Map<string, IdeaPersonRole>()
  const identityIds = new Set<string>()

  if (!isOwner) {
    // Owner is visible to any member community.
    if (idea.owner_id !== viewerId) {
      identityIds.add(idea.owner_id)
      roleByUserId.set(idea.owner_id, 'owner')
    }
  }

  for (const id of memberIds) {
    if (id === viewerId) continue // self never appears on one's own cards
    identityIds.add(id)
    roleByUserId.set(id, 'member')
  }

  for (const request of joinRequests) {
    const role: IdeaPersonRole =
      request.status === 'approved' ? 'member' : 'applicant'
    // Only the owner may see pending applicants; members see approved only.
    if (request.status !== 'approved' && !isOwner) continue
    if (isOwner && request.user_id === viewerId) continue
    identityIds.add(request.user_id)
    roleByUserId.set(request.user_id, role)
  }

  const projections = await projectPeople(viewerId, Array.from(identityIds), {
    dao,
  })
  const people: IdeaPersonCard[] = projections.map((projection) => ({
    ...projection,
    role: roleByUserId.get(projection.userId) ?? 'member',
  }))

  return {
    ideaId: idea.id,
    title: idea.title,
    visible: true,
    accessible: true,
    membershipState,
    canMessageCommunity: true,
    interestCount: idea.validation_count ?? 0,
    memberCount: participantCount,
    joinEnabled: idea.join_enabled,
    owner: { id: idea.owner_id, role: ownerRole },
    people,
  }
}
