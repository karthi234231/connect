'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, UsersRound } from 'lucide-react'
import {
  Breadcrumb,
  Button,
  Card,
  CardContent,
  Chip,
  StatusPill,
} from '@/components/ui'
import { LoadingState } from '@/components/states/LoadingState'
import { NotFoundState } from '@/components/states/NotFoundState'
import { useEffect } from 'react'
import {
  approveJoinRequestAction,
  getIdeaAction,
  listIdeaReactionsAction,
  listJoinRequestsAction,
  rejectJoinRequestAction,
  removeIdeaReactionAction,
  requestJoinAction,
  toggleIdeaReactionAction,
  toggleJoinEnabledAction,
  trackIdeaViewedAction,
  validateIdeaAction,
} from '@/app/actions/ideas'
import { ReactionBar } from '@/components/ideas'
import { queryClient, useQuery } from '@/client/query/client'
import { initialsForName } from '@/types/profile'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type { IdeaDetailDTO } from '@/services/ideas/idea.schema'
import type { IdeaReactionSummary } from '@/services/ideas/reactions'

const joinStatusLabel: Record<string, string> = {
  none: 'Not joined yet',
  pending: 'Request pending',
  approved: 'On the team',
  rejected: 'Not on the team this time',
}

const stageTone = (stage: string): 'info' | 'brand' | 'success' => {
  switch (stage) {
    case 'prototype':
      return 'brand'
    case 'mvp':
    case 'launched':
      return 'success'
    default:
      return 'info'
  }
}

export default function IdeaDetailPage() {
  const { ideaId } = useParams<{ ideaId: string }>()
  const router = useRouter()

  const ideasKey = ['ideas', ideaId].join('/')

  const {
    data: idea,
    isLoading,
    error,
    refetch,
  } = useQuery<IdeaDetailDTO>(ideasKey, () => getIdeaAction(ideaId))

  // Only the owner's queue is ever fetched — the key flips when ownership
  // resolves so a viewer's mount never queries join_requests (RLS-guarded).
  const requestsKey = `${ideasKey}/join-requests/${idea?.isOwner ? 'owner' : 'viewer'}`

  const { data: requests = [], refetch: refetchRequests } = useQuery(
    requestsKey,
    () =>
      idea?.isOwner ? listJoinRequestsAction(ideaId) : Promise.resolve([]),
  )

  // Reactions drive the detail page's ReactionBar. `mine` per emoji comes from
  // the service; likes = total hearts, liked = the viewer currently reacted.
  const reactionsKey = `${ideasKey}/reactions`

  const { data: reactions = [], refetch: refetchReactions } = useQuery<
    IdeaReactionSummary[]
  >(reactionsKey, () => listIdeaReactionsAction(ideaId))

  const likeCount = reactions.reduce(
    (total, reaction) => total + reaction.count,
    0,
  )
  const liked = reactions.some((reaction) => reaction.mine)

  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinNote, setJoinNote] = useState('')
  const [joinNoteOpen, setJoinNoteOpen] = useState(false)
  const [togglingJoin, setTogglingJoin] = useState(false)
  const [reacting, setReacting] = useState(false)

  // Fire the view signal once per idea id, after the read succeeds, for a
  // non-owner. Best-effort — analytics never blocks or errors the reader.
  useEffect(() => {
    if (idea && !idea.isOwner) {
      void trackIdeaViewedAction(idea.id)
    }
  }, [idea?.id, idea?.isOwner]) // eslint-disable-line react-hooks/exhaustive-deps
  async function validate(action: 'like' | 'pass') {
    if (validating) return
    setValidating(true)
    try {
      await validateIdeaAction({ ideaId, action })
      queryClient.invalidate(ideasKey)
      await refetch()
    } catch {
      showErrorToast('That could not be recorded. Please try again.')
    } finally {
      setValidating(false)
    }
  }

  // Heart toggle: off when liked, on when not. Replace semantics (like the
  // migration's comment) — one reaction per (idea, user), emoji changes go
  // through delete + insert.
  async function toggleReaction() {
    if (reacting) return
    setReacting(true)
    try {
      if (liked) {
        await removeIdeaReactionAction({ ideaId, emoji: '❤️' })
      } else {
        await toggleIdeaReactionAction({ ideaId, emoji: '❤️' })
      }
      queryClient.invalidate(reactionsKey)
      await refetchReactions()
    } catch {
      showErrorToast('That reaction could not be saved. Please try again.')
    } finally {
      setReacting(false)
    }
  }

  async function join() {
    if (joining) return
    setJoining(true)
    try {
      await requestJoinAction({
        ideaId,
        message: joinNote.trim() === '' ? undefined : joinNote.trim(),
      })
      setJoinNoteOpen(false)
      setJoinNote('')
      queryClient.invalidate(ideasKey)
      await refetch()
      showSuccessToast('Join request sent')
    } catch (err) {
      showErrorToast(
        err instanceof Error
          ? err.message
          : 'That join request could not be sent.',
      )
    } finally {
      setJoining(false)
    }
  }

  async function toggleJoin(next: boolean) {
    if (togglingJoin) return
    setTogglingJoin(true)
    try {
      await toggleJoinEnabledAction({ ideaId, joinEnabled: next })
      queryClient.invalidate(ideasKey)
      await refetch()
    } catch {
      showErrorToast('That could not be saved. Please try again.')
    } finally {
      setTogglingJoin(false)
    }
  }

  async function review(decision: 'approve' | 'reject', requestId: string) {
    setReviewingId(requestId)
    setReviewError(null)
    try {
      if (decision === 'approve') {
        await approveJoinRequestAction({ ideaId, joinRequestId: requestId })
      } else {
        await rejectJoinRequestAction({ ideaId, joinRequestId: requestId })
      }
      queryClient.invalidate(ideasKey)
      queryClient.invalidate(requestsKey)
      await Promise.all([refetch(), refetchRequests()])
    } catch {
      setReviewError("That didn't go through. Please try again.")
    } finally {
      setReviewingId(null)
    }
  }

  const pending = requests.filter((request) => request.status === 'pending')
  const collaborators = requests.filter(
    (request) => request.status === 'approved',
  )

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/ideas"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <ArrowLeft className="size-3.5" /> Back to ideas
        </Link>

        {isLoading ? (
          <LoadingState />
        ) : error || !idea ? (
          <NotFoundState
            title="Idea not found"
            description="We couldn't find that idea."
            action={
              <Link href="/dashboard/ideas">
                <Button variant="ghost">Back to ideas</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            <Breadcrumb
              items={[
                {
                  label: 'Ideas',
                  onClick: () => router.push('/dashboard/ideas'),
                },
                { label: idea.title },
              ]}
            />
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[28px]">
                    {idea.title}
                  </h1>
                  <StatusPill
                    label={idea.stage}
                    tone={stageTone(idea.stage)}
                    className="shrink-0"
                  />
                </div>

                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-[var(--cx-text-2)]">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      Problem
                    </span>
                    {idea.problem}
                  </p>
                  <p className="text-sm leading-6 text-[var(--cx-text-2)]">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      Solution
                    </span>
                    {idea.solution}
                  </p>
                  <p className="text-sm leading-6 text-[var(--cx-text-2)]">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      What I need
                    </span>
                    {idea.ask}
                  </p>
                </div>

                {joinNoteOpen && !idea.isOwner ? (
                  <div className="mt-4 rounded-xl border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                        Add a note (optional)
                      </span>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={joinNote}
                        onChange={(e) => setJoinNote(e.target.value)}
                        placeholder="Say how you'd like to help"
                        disabled={joining}
                        className="w-full resize-none rounded-2xl border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-[var(--cx-text-4)] focus:border-[var(--cx-brand)]"
                      />
                    </label>
                    <div className="mt-3 flex gap-2">
                      <Button disabled={joining} onClick={() => void join()}>
                        {joining ? 'Sending…' : 'Send request'}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={joining}
                        onClick={() => setJoinNoteOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {(idea.tags.length > 0 || idea.teamNeeded.length > 0) && (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {idea.tags.map((tag) => (
                      <Chip key={tag} className="pointer-events-none">
                        {tag}
                      </Chip>
                    ))}
                    {idea.teamNeeded.map((need) => (
                      <Chip key={need} active className="pointer-events-none">
                        {need}
                      </Chip>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[var(--cx-text-3)]">
                    {idea.validationCount} validations
                    {idea.owner.role ? ` · Open to ${idea.owner.role}s` : ''}
                  </span>
                  <Chip
                    active={idea.joinStatus === 'approved'}
                    className="pointer-events-none"
                  >
                    {joinStatusLabel[idea.joinStatus] ?? joinStatusLabel.none}
                  </Chip>
                </div>

                <div className="mt-5 border-t border-[var(--cx-border-1)] pt-4">
                  <ReactionBar
                    likes={likeCount}
                    replies={0}
                    liked={liked}
                    onLike={() => void toggleReaction()}
                  />
                </div>

                {idea.isOwner ? (
                  <div className="mt-6 flex-wrap items-center gap-2 border-t border-[var(--cx-border-1)] pt-5">
                    <Link href={`/dashboard/ideas/${idea.id}/edit`}>
                      <Button variant="ghost">Edit</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      disabled={togglingJoin}
                      onClick={() => void toggleJoin(!idea.joinEnabled)}
                    >
                      {idea.joinEnabled
                        ? 'Close join requests'
                        : 'Open join requests'}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 flex-wrap items-center gap-2 border-t border-[var(--cx-border-1)] pt-5">
                    <Button
                      variant="ghost"
                      disabled={validating}
                      onClick={() => void validate('like')}
                    >
                      Validate
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={validating}
                      onClick={() => void validate('pass')}
                    >
                      Pass
                    </Button>
                    <span className="flex-1" />
                    {idea.joinStatus === 'approved' ? (
                      <Chip active className="pointer-events-none">
                        On the team
                      </Chip>
                    ) : idea.joinStatus === 'pending' ? (
                      <Chip className="pointer-events-none">
                        Request pending
                      </Chip>
                    ) : idea.canJoin ? (
                      <Button
                        disabled={joining}
                        onClick={() => setJoinNoteOpen((open) => !open)}
                      >
                        {joining ? 'Sending…' : 'Ask to join'}
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {idea.isOwner && (
              <>
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <UsersRound className="size-4 text-[var(--cx-brand-strong)]" />
                      <h2 className="text-sm font-medium">
                        Join requests
                        {pending.length > 0 && (
                          <span className="ml-1.5 text-[var(--cx-text-3)]">
                            ({pending.length})
                          </span>
                        )}
                      </h2>
                    </div>

                    {reviewError && (
                      <p className="mt-3 text-xs text-[var(--cx-danger)]">
                        {reviewError}
                      </p>
                    )}

                    {pending.length === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
                        No pending requests — you're all caught up.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {pending.map((request) => (
                          <div
                            key={request.id}
                            className="rounded-xl border border-[var(--cx-border-1)] p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e4c1aa] text-[11px] font-semibold text-[#3b2822]">
                                {initialsForName(
                                  request.applicant?.fullName ?? '?',
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {request.applicant?.fullName ?? 'Member'}
                                </p>
                                <p className="text-[10px] uppercase tracking-[.12em] text-[var(--cx-text-4)]">
                                  {request.applicant?.role ?? 'role'}
                                </p>
                              </div>
                            </div>
                            {request.message && (
                              <p className="mt-2.5 text-xs leading-5 text-[var(--cx-text-2)]">
                                {request.message}
                              </p>
                            )}
                            <div className="mt-3.5 flex gap-2">
                              <Button
                                size="sm"
                                disabled={reviewingId === request.id}
                                onClick={() =>
                                  void review('approve', request.id)
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={reviewingId === request.id}
                                onClick={() =>
                                  void review('reject', request.id)
                                }
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <h2 className="text-sm font-medium">Collaborators</h2>
                    {collaborators.length === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
                        No one has joined yet — approve a request to build the
                        team.
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {collaborators.map((member) => (
                          <Chip
                            key={member.id}
                            active
                            className="pointer-events-none"
                          >
                            {member.applicant?.fullName ?? 'Member'}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
