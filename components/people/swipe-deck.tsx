'use client'

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Check, Clock3, MapPin, UsersRound, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui'
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
  onDetail?: (person: Person) => void
  likeLimit?: number
  liked?: string[]
  className?: string
}

export function SwipeDeck({
  people,
  onLike,
  onPass,
  onDetail,
  likeLimit,
  liked,
  className,
}: SwipeDeckProps) {
  const [pending, setPending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [rightSwipes, setRightSwipes] = useState(0)
  const startXRef = useRef<number>(0)

  const person = people[0] ?? null
  const atLimit = likeLimit !== undefined && rightSwipes >= likeLimit
  const isLiked = liked ? liked.includes(person?.id ?? '') : false
  const likeDisabled = atLimit || isLiked || pending

  const likeCurrent = useCallback(async () => {
    if (!person || atLimit || isLiked || pending) return
    setPending(true)
    try {
      await onLike?.(person)
      setRightSwipes((count) => count + 1)
    } catch {
      // keep the card in place; the caller surfaces the failure
    } finally {
      setPending(false)
      setDragX(0)
    }
  }, [person, atLimit, isLiked, pending, onLike])

  const passCurrent = useCallback(async () => {
    if (!person || pending) return
    setPending(true)
    try {
      await onPass?.(person)
    } catch {
      // keep the card in place; the caller surfaces the failure
    } finally {
      setPending(false)
      setDragX(0)
    }
  }, [person, pending, onPass])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pending) return
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
          'flex min-h-[300px] w-full items-center justify-center rounded-[24px] border border-dashed border-[var(--cx-border-2)] p-4 text-sm text-[var(--cx-text-3)]',
          className,
        )}
      >
        No people found.
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

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative touch-pan-y select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      >
        {dragging ? (
          <div
            aria-hidden
            className="absolute inset-0 z-0 scale-[0.97] rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] opacity-60"
          />
        ) : null}
        <article
          className={cn(
            'relative z-10 overflow-hidden rounded-[24px] border border-[var(--cx-border-1)] bg-[color-mix(in_srgb,var(--cx-brand-soft)_55%,var(--cx-surface-1))] p-4 sm:min-h-[430px]',
            dragging
              ? 'shadow-[var(--cx-shadow-card)]'
              : 'transition-transform',
          )}
          style={
            dragging
              ? {
                  transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`,
                }
              : undefined
          }
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color-mix(in_srgb,var(--cx-brand)_20%,transparent)] blur-2xl"
          />
          <span className="absolute right-4 top-4 z-10 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-2)]">
            {people.length} in deck
          </span>

          <div className="relative z-10">
            <Avatar avatarClassName="size-14" className={person.tone}>
              {person.avatarUrl ? (
                <AvatarImage src={person.avatarUrl} alt={person.name} />
              ) : (
                <AvatarFallback className="text-sm font-semibold text-[#332d3d]">
                  {person.initials}
                </AvatarFallback>
              )}
            </Avatar>
            <button
              type="button"
              onClick={() => onDetail?.(person)}
              className="mt-3 block text-left"
            >
              <h3 className="font-display text-xl font-semibold">
                {person.name}
              </h3>
            </button>
            {person.role ? (
              <p className="mt-1 text-xs text-[var(--cx-text-2)]">
                {person.role}
              </p>
            ) : null}
            {metaLine ? (
              <p className="text-xs text-[var(--cx-text-3)]">{metaLine}</p>
            ) : null}

            {typeof person.score === 'number' ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[var(--cx-brand-soft)] px-2 py-1 text-[10px] font-medium text-[var(--cx-brand-strong)]">
                  {person.score}% match
                </span>
                {(person.factors ?? []).map((factor) => (
                  <span
                    key={factor.label}
                    className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2 py-1 text-[10px] text-[var(--cx-text-3)]"
                  >
                    {factor.label} · {factor.value}%
                  </span>
                ))}
              </div>
            ) : null}

            {person.experience || person.education ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {person.experience ? (
                  <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                      Experience
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--cx-text-1)]">
                      {person.experience}
                    </p>
                  </div>
                ) : null}
                {person.education ? (
                  <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                      Education
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-[var(--cx-text-1)]">
                      {person.education.split(' · ')[0] ?? person.education}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {person.location || person.experience || mutualsLine ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--cx-text-3)]">
                {person.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {person.location}
                  </span>
                ) : null}
                {person.experience ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    {person.experience}
                  </span>
                ) : null}
                {mutualsLine ? (
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="size-3.5" />
                    {mutualsLine}
                  </span>
                ) : null}
              </p>
            ) : null}

            {person.note ? (
              <p className="mt-3 text-sm leading-5 text-[var(--cx-text-2)]">
                {person.note}
              </p>
            ) : null}
            {person.availability ? (
              <p className="mt-1.5 text-xs text-[var(--cx-success)]">
                {person.availability}
              </p>
            ) : null}

            {person.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {person.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--cx-surface-1)] px-2 py-1 text-[10px] text-[var(--cx-text-3)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={`Pass ${person.name}`}
          disabled={pending}
          aria-disabled={pending}
          onClick={() => void passCurrent()}
          className="flex size-10 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="size-5" />
        </button>
        <button
          type="button"
          aria-label={isLiked ? `Liked ${person.name}` : `Like ${person.name}`}
          aria-pressed={isLiked}
          disabled={likeDisabled}
          aria-disabled={likeDisabled}
          onClick={() => void likeCurrent()}
          className="flex size-14 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white transition hover:bg-[var(--cx-brand-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="size-6" />
        </button>
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
