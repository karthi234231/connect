'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Briefcase,
  Check,
  Clock3,
  MapPin,
  RotateCcw,
  Sparkles,
  Target,
  UsersRound,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
import { MatchScoreBadge } from '@/components/matching/match-score-badge'
import { SkillOverlapBadge } from '@/components/matching/skill-overlap-badge'
import { getIntentLabel } from '@/services/profiles/intent'
import type { Person } from './person'
import { cn } from '@/utils/cn'

/**
 * Resolve the swipe's saved outcome. Returning a rejected promise (or `false`)
 * keeps the current card in place so the caller can surface a failure and let
 * the viewer retry the same card.
 */
export type SwipeOutcome = void | boolean | Promise<void | boolean>

export interface SwipeDeckProps {
  /** Queue of candidates — the deck always presents `people[0]`. */
  people: Person[]
  onLike?: (person: Person) => SwipeOutcome
  onPass?: (person: Person) => SwipeOutcome
  /** Restores the previous passed candidate back into the deck. */
  onUndo?: () => void | Promise<void>
  /** Whether an undo action is available. */
  canUndo?: boolean
  onDetail?: (person: Person) => void
  likeLimit?: number
  liked?: string[]
  className?: string
}

export function SwipeDeck({
  people,
  onLike,
  onPass,
  onUndo,
  canUndo = false,
  onDetail,
  likeLimit,
  liked,
  className,
}: SwipeDeckProps) {
  const [pending, setPending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null)
  const [rightSwipes, setRightSwipes] = useState(0)
  const startXRef = useRef<number>(0)

  const person = people[0] ?? null
  const nextPerson = people[1] ?? null
  const atLimit = likeLimit !== undefined && rightSwipes >= likeLimit
  const isLiked = liked ? liked.includes(person?.id ?? '') : false
  const likeDisabled = atLimit || isLiked || pending || exitDirection != null

  const likeCurrent = useCallback(async () => {
    if (!person || atLimit || isLiked || pending || exitDirection != null) return
    setExitDirection('right')
    setPending(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 180))
      await onLike?.(person)
      setRightSwipes((count) => count + 1)
    } catch {
      // Keep card in place on error
    } finally {
      setExitDirection(null)
      setPending(false)
      setDragX(0)
    }
  }, [person, atLimit, isLiked, pending, exitDirection, onLike])

  const passCurrent = useCallback(async () => {
    if (!person || pending || exitDirection != null) return
    setExitDirection('left')
    setPending(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 180))
      await onPass?.(person)
    } catch {
      // Keep card in place on error
    } finally {
      setExitDirection(null)
      setPending(false)
      setDragX(0)
    }
  }, [person, pending, exitDirection, onPass])

  const handleUndo = useCallback(async () => {
    if (!onUndo || !canUndo || pending || exitDirection != null) return
    setPending(true)
    try {
      await onUndo()
    } catch {
      // Keep card in place on error
    } finally {
      setPending(false)
    }
  }, [onUndo, canUndo, pending, exitDirection])

  // Keyboard navigation: ArrowLeft (Pass), ArrowRight (Connect/Like), Backspace/U (Undo)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Do not intercept key combinations (e.g. Cmd+Arrow, Alt+Arrow)
      if (event.metaKey || event.ctrlKey || event.altKey) return

      // Do not trigger keybindings if user is focused inside an input element or modal
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return
      }

      // Check if a modal dialog is currently open
      if (document.querySelector('[role="dialog"]') !== null) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        void passCurrent()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        void likeCurrent()
      } else if (
        (event.key === 'Backspace' || event.key === 'u' || event.key === 'U') &&
        canUndo
      ) {
        event.preventDefault()
        void handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [likeCurrent, passCurrent, handleUndo, canUndo])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pending || exitDirection != null) return
    startXRef.current = event.clientX
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragX(event.clientX - startXRef.current)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const delta = event.clientX - startXRef.current
    setDragging(false)
    setDragX(0)
    if (delta > 55) void likeCurrent()
    else if (delta < -55) void passCurrent()
  }

  const handlePointerCancel = () => {
    setDragging(false)
    setDragX(0)
  }

  if (people.length === 0 || !person) {
    return (
      <div
        className={cn(
          'flex min-h-[300px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--cx-border-2)] p-6 text-center text-sm text-[var(--cx-text-3)] gap-3',
          className,
        )}
      >
        <p>No people left in deck.</p>
        {canUndo && onUndo ? (
          <button
            type="button"
            onClick={() => void handleUndo()}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-4 py-2 text-xs font-semibold text-[var(--cx-brand-strong)] shadow-xs transition hover:bg-[var(--cx-surface-2)] hover:border-[var(--cx-brand)] active:scale-95 disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            <span>Undo last pass</span>
          </button>
        ) : null}
      </div>
    )
  }

  const metaLine = [person.company, person.location].filter(Boolean).join(' · ')
  const mutualsLine = [
    person.mutuals > 0 ? `${person.mutuals} mutuals` : '',
    person.education,
  ]
    .filter(Boolean)
    .join(' · ')

  const offeringList = (person.offering && person.offering.length > 0)
    ? person.offering
    : (person.tags && person.tags.length > 0 ? person.tags : [])

  const lookingForList = (person.lookingFor && person.lookingFor.length > 0)
    ? person.lookingFor
    : (person.interests && person.interests.length > 0 ? person.interests : [])

  const overlapSet = new Set((person.skillOverlap ?? []).map((s) => s.toLowerCase().trim()))

  const dragOpacity = Math.min(Math.abs(dragX) / 75, 1)

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative touch-none select-none min-h-[440px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        {/* Next card preview in stack */}
        {nextPerson ? (
          <div
            aria-hidden
            className="absolute inset-0 z-0 scale-[0.96] translate-y-3 rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] opacity-70 pointer-events-none"
          />
        ) : null}

        {/* Active Swiping Card */}
        <article
          className={cn(
            'relative z-10 overflow-hidden rounded-[24px] border border-[var(--cx-border-1)] bg-[color-mix(in_srgb,var(--cx-brand-soft)_40%,var(--cx-surface-1))] p-5 shadow-[var(--cx-shadow-card)] transition-all duration-200',
            exitDirection === 'right' && 'translate-x-[450px] rotate-25 opacity-0',
            exitDirection === 'left' && '-translate-x-[450px] -rotate-25 opacity-0',
            !dragging && exitDirection == null && 'transition-transform duration-200',
          )}
          style={
            dragging && exitDirection == null
              ? {
                  transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`,
                }
              : undefined
          }
        >
          {/* Visual Swipe Gesture Stamp Overlay (Connect / Pass) */}
          {dragging && dragX > 20 ? (
            <div
              className="pointer-events-none absolute left-6 top-6 z-30 rounded-xl border-2 border-[var(--cx-brand-strong)] bg-[var(--cx-brand-soft)]/90 px-4 py-1.5 font-display text-lg font-extrabold uppercase tracking-wider text-[var(--cx-brand-strong)] shadow-lg transition-opacity"
              style={{ opacity: dragOpacity }}
            >
              <div className="flex items-center gap-1.5">
                <Check className="size-5" />
                <span>CONNECT</span>
              </div>
            </div>
          ) : null}

          {dragging && dragX < -20 ? (
            <div
              className="pointer-events-none absolute right-6 top-6 z-30 rounded-xl border-2 border-[var(--cx-danger)] bg-[var(--cx-danger-soft)]/90 px-4 py-1.5 font-display text-lg font-extrabold uppercase tracking-wider text-[var(--cx-danger)] shadow-lg transition-opacity"
              style={{ opacity: dragOpacity }}
            >
              <div className="flex items-center gap-1.5">
                <X className="size-5" />
                <span>PASS</span>
              </div>
            </div>
          ) : null}

          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color-mix(in_srgb,var(--cx-brand)_20%,transparent)] blur-2xl"
          />
          <span className="absolute right-4 top-4 z-10 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]/90 backdrop-blur-xs px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-2)]">
            {people.length} in deck
          </span>

          <div className="relative z-10 space-y-4">
            {/* Header: Avatar, Name, Role, Match Score */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5 min-w-0">
                <Avatar avatarClassName="size-14 shrink-0 shadow-md" className={person.tone}>
                  {person.avatarUrl ? (
                    <AvatarImage src={person.avatarUrl} alt={person.name} />
                  ) : (
                    <AvatarFallback className="text-base font-semibold text-[#332d3d]">
                      {person.initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onDetail?.(person)}
                    className="group block text-left focus:outline-none"
                  >
                    <h3 className="truncate font-display text-xl font-bold tracking-tight text-[var(--cx-text-1)] group-hover:text-[var(--cx-brand-strong)] transition-colors">
                      {person.name}
                    </h3>
                  </button>
                  {person.role ? (
                    <p className="truncate text-xs font-semibold text-[var(--cx-brand-strong)] mt-0.5">
                      {getIntentLabel(person.role) ?? person.role}
                    </p>
                  ) : null}
                  {metaLine ? (
                    <p className="mt-0.5 truncate text-xs text-[var(--cx-text-3)]">{metaLine}</p>
                  ) : null}
                </div>
              </div>

              {typeof person.score === 'number' ? (
                <MatchScoreBadge score={person.score} factors={person.factors} size="sm" />
              ) : null}
            </div>

            {/* Location & Availability meta row */}
            {person.location || person.availability || mutualsLine ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                {person.location ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--cx-text-2)] bg-[var(--cx-surface-1)] px-2.5 py-1 rounded-full border border-[var(--cx-border-1)]">
                    <MapPin className="size-3.5 text-[var(--cx-brand)]" />
                    {person.location}
                  </span>
                ) : null}

                {person.availability ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--cx-success)] bg-[var(--cx-success-soft)] px-2.5 py-1 rounded-full">
                    <Clock3 className="size-3.5" />
                    {person.availability}
                  </span>
                ) : null}

                {mutualsLine ? (
                  <span className="inline-flex items-center gap-1 text-[var(--cx-text-3)]">
                    <UsersRound className="size-3.5" />
                    {mutualsLine}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Bio Section */}
            {person.note ? (
              <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]/80 p-3.5 shadow-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)] mb-1">
                  Bio
                </p>
                <p className="text-xs leading-5 text-[var(--cx-text-2)]">
                  {person.note}
                </p>
              </div>
            ) : null}

            {/* Collaboration Intent Grid: Offering & Looking For */}
            {(offeringList.length > 0 || lookingForList.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {offeringList.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                      <Briefcase className="size-3 text-[var(--cx-brand)]" />
                      <span>Offering</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {offeringList.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2.5 py-0.5 text-[11px] text-[var(--cx-text-2)]"
                        >
                          {getIntentLabel(item) ?? item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lookingForList.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                      <Target className="size-3 text-[var(--cx-info)]" />
                      <span>Looking for</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {lookingForList.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-[var(--cx-brand-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--cx-brand-strong)]"
                        >
                          {getIntentLabel(item) ?? item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Skills Offered Tag Cloud (Highlighting Overlaps) */}
            {person.tags.length > 0 ? (
              <div className="pt-2 border-t border-[var(--cx-border-1)]">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                    Skills Offered
                  </p>
                  {overlapSet.size > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--cx-brand)]">
                      <Sparkles className="size-3" />
                      {overlapSet.size} shared skills
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {person.tags.map((tag) => (
                    <SkillOverlapBadge
                      key={tag}
                      skill={tag}
                      isOverlap={overlapSet.has(tag.toLowerCase().trim())}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      {/* Action Buttons & Keyboard Hints */}
      <div className="mt-5 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label="Undo last swipe"
              disabled={!canUndo || pending}
              aria-disabled={!canUndo || pending}
              onClick={() => void handleUndo()}
              className="flex size-12 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-brand-strong)] shadow-sm transition hover:bg-[var(--cx-surface-2)] hover:border-[var(--cx-brand)] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="size-5" />
            </button>
            <span className="text-[10px] font-medium text-[var(--cx-text-4)]">Undo</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={`Pass ${person.name}`}
              disabled={pending}
              aria-disabled={pending}
              onClick={() => void passCurrent()}
              className="flex size-12 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-danger)] shadow-sm transition hover:bg-[var(--cx-danger-soft)] hover:border-[var(--cx-danger)] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-6" />
            </button>
            <span className="text-[10px] font-medium text-[var(--cx-text-4)]">Pass</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={isLiked ? `Liked ${person.name}` : `Connect with ${person.name}`}
              aria-pressed={isLiked}
              disabled={likeDisabled}
              aria-disabled={likeDisabled}
              onClick={() => void likeCurrent()}
              className="flex size-16 items-center justify-center rounded-full bg-gradient-to-r from-[var(--cx-brand)] to-[#e0b874] text-[var(--cx-bg)] shadow-[0_0_20px_rgba(208,164,91,0.35)] transition hover:brightness-110 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="size-8 stroke-[3]" />
            </button>
            <span className="text-[10px] font-semibold text-[var(--cx-brand-strong)]">Connect</span>
          </div>
        </div>

        {/* Keyboard shortcut hint badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-[var(--cx-text-4)] mt-1">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--cx-text-3)]">
              ←
            </kbd>{' '}
            Pass
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--cx-text-3)]">
              →
            </kbd>{' '}
            Connect
          </span>
          {canUndo ? (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--cx-text-3)]">
                  Backspace
                </kbd>{' '}
                Undo
              </span>
            </>
          ) : null}
        </div>
      </div>

      {likeLimit !== undefined ? (
        <p className="mt-2 text-center text-[10px] text-[var(--cx-text-4)]">
          {Math.max(likeLimit - rightSwipes, 0)} likes left
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label={`${people.length} in deck`}
        className="mt-4 flex items-center justify-center gap-1.5"
      >
        {people.slice(0, 8).map((dot, dotIndex) => (
          <span
            key={dot.id}
            className={cn(
              'h-1.5 rounded-full transition-all',
              dotIndex === 0
                ? 'w-5 bg-[var(--cx-brand)]'
                : 'w-1.5 bg-[var(--cx-border-2)]',
            )}
          />
        ))}
      </div>
    </div>
  )
}
