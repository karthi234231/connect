'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui'
import { Bookmark, ChevronRight, Heart, Lightbulb, Share2, Users, Wrench } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Idea } from './idea'
import { useIdeaBookmark } from './use-idea-bookmark'
import { ShareIdeaModal } from './share-idea-modal'

export interface IdeaCardProps {
  idea: Idea
  onJoin?: (idea: Idea) => void
  onUpvote?: (idea: Idea) => void
  onBookmark?: (idea: Idea, isBookmarked: boolean) => void
  onShare?: (idea: Idea) => void
  footerMeta?: string
  footerAction?: ReactNode
}

export function IdeaCard({
  idea,
  onJoin,
  onUpvote,
  onBookmark,
  onShare,
  footerMeta,
  footerAction,
}: IdeaCardProps): ReactNode {
  const [upvoted, setUpvoted] = useState(idea.isUpvoted ?? false)
  const [upvoteCount, setUpvoteCount] = useState(idea.upvotesCount ?? 0)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const { isBookmarked, toggleBookmark } = useIdeaBookmark(
    idea.id,
    idea.isBookmarked,
  )

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextUpvoted = !upvoted
    setUpvoted(nextUpvoted)
    setUpvoteCount((prev) => (nextUpvoted ? prev + 1 : Math.max(0, prev - 1)))
    onUpvote?.(idea)
  }

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = toggleBookmark(e)
    onBookmark?.(idea, nextState)
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onShare) {
      onShare(idea)
    } else {
      setShareModalOpen(true)
    }
  }

  const teamNeededSkills = idea.teamNeeded ?? []
  const hasCollaboratorIntent = idea.joinEnabled || teamNeededSkills.length > 0

  return (
    <>
      <article className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[var(--cx-surface-1)] p-4 sm:p-5 transition-all duration-200 hover:border-[var(--cx-brand)]/40 hover:shadow-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 size-36 rounded-full bg-[var(--cx-brand)]/15 blur-3xl"
        />
        <div className="relative flex h-full flex-col gap-3">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[var(--cx-idea)]">
                <Lightbulb className="size-3.5" aria-hidden="true" />
                <span className="text-[10px] font-semibold tracking-[0.16em] uppercase">
                  Idea
                </span>
              </span>
              {idea.tag ? (
                <span className="rounded-full bg-[color:var(--cx-idea)/.15] px-2 py-0.5 text-[10px] font-medium text-[var(--cx-idea)]">
                  {idea.tag}
                </span>
              ) : null}
            </div>

            {/* Header Right Actions & Collaborator Intent Chip */}
            <div className="flex items-center gap-1.5">
              {hasCollaboratorIntent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cx-brand-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--cx-brand-strong)]">
                  <Users className="size-3" aria-hidden="true" />
                  {idea.joinEnabled ? 'Open to Join' : 'Seeking Team'}
                </span>
              )}
              <button
                type="button"
                onClick={handleBookmark}
                aria-label={
                  isBookmarked
                    ? `Remove bookmark for ${idea.title}`
                    : `Bookmark ${idea.title}`
                }
                title={isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                  isBookmarked
                    ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                    : 'text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
                )}
              >
                <Bookmark
                  className={cn('size-3.5', isBookmarked && 'fill-current')}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label={`Share ${idea.title}`}
                title="Share idea"
                className="inline-flex size-7 items-center justify-center rounded-full text-[var(--cx-text-3)] transition-colors hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl leading-snug tracking-[-.025em]">
              {idea.title}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
                <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--cx-text-4)]">
                  Problem
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--cx-text-2)] line-clamp-3">
                  {idea.problem}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
                <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--cx-text-4)]">
                  Approach
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--cx-text-2)] line-clamp-3">
                  {idea.approach}
                </p>
              </div>
            </div>

            {/* Team Skill Matching Badges */}
            {teamNeededSkills.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mr-1 flex items-center gap-1">
                  <Wrench className="size-2.5" /> Skills needed:
                </span>
                {teamNeededSkills.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-md border border-[var(--cx-brand)]/20 bg-[var(--cx-brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--cx-brand-strong)]"
                  >
                    {skill}
                  </span>
                ))}
                {teamNeededSkills.length > 4 && (
                  <span className="text-[10px] text-[var(--cx-text-4)]">
                    +{teamNeededSkills.length - 4} more
                  </span>
                )}
              </div>
            )}

            <p className="text-xs leading-5 text-[var(--cx-text-3)]">
              {idea.meta}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between border-t border-[var(--cx-border-1)] pt-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar avatarClassName={cn('size-8', idea.tone)}>
                <AvatarFallback className="text-[10px] text-[#332d3d]">
                  {idea.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--cx-text-1)]">
                  {idea.author}
                </p>
                {footerMeta ? (
                  <p className="truncate text-[11px] text-[var(--cx-text-3)]">
                    {footerMeta}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Upvote / Endorse Button */}
            <button
              type="button"
              onClick={handleUpvote}
              aria-label={`Upvote ${idea.title}`}
              aria-pressed={upvoted}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150',
                upvoted
                  ? 'bg-[var(--cx-danger)]/15 text-[var(--cx-danger)]'
                  : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]',
              )}
            >
              <Heart
                className={cn('size-3.5', upvoted && 'fill-current')}
                aria-hidden="true"
              />
              <span className="tabular-nums">{upvoteCount}</span>
            </button>
          </div>

          {footerAction ??
            (onJoin ? (
              <button
                type="button"
                onClick={() => onJoin(idea)}
                aria-label={`Join ${idea.title}`}
                className="flex w-full items-center justify-between rounded-xl bg-[var(--cx-brand)] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-[var(--cx-brand-strong)]"
              >
                Join this idea
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            ) : null)}
        </div>
      </article>

      <ShareIdeaModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        idea={{
          id: idea.id,
          title: idea.title,
          problem: idea.problem,
          author: idea.author,
        }}
      />
    </>
  )
}
