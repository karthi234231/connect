'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Idea } from './idea'
import { IdeaCard } from './idea-card'

const SWIPE_THRESHOLD = 55

export interface IdeaDeckProps {
  ideas: Idea[]
  onJoin?: (idea: Idea) => void
  onSwipe?: (idea: Idea) => void
  seenLimit?: number
}

export function IdeaDeck({
  ideas,
  onJoin,
  onSwipe,
  seenLimit = 10,
}: IdeaDeckProps): ReactNode {
  const [index, setIndex] = useState(0)
  const [seen, setSeen] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const current = ideas[index]
  const exhausted = !current

  function advance() {
    const idea = ideas[index]
    if (!idea) return
    setSeen((value) => Math.min(value + 1, seenLimit))
    setIndex((value) => value + 1)
    onSwipe?.(idea)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    startXRef.current = event.clientX
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || startXRef.current == null) return
    setDragX(event.clientX - startXRef.current)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    const delta = event.clientX - (startXRef.current ?? event.clientX)
    startXRef.current = null
    setDragX(0)
    if (Math.abs(delta) > SWIPE_THRESHOLD) advance()
  }

  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-roledescription="Idea deck"
        className={cn(
          'relative touch-none select-none',
          dragging ? '' : 'transition-transform duration-200 ease-out',
        )}
        style={
          dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {exhausted ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-8 py-10 text-center">
            <Sparkles
              className="size-5 text-[var(--cx-idea)]"
              aria-hidden="true"
            />
            <p className="font-display text-lg font-medium leading-snug tracking-[-.02em]">
              You're all caught up
            </p>
            <p className="text-xs text-[var(--cx-text-3)]">
              Check back later for fresh ideas from your network.
            </p>
          </div>
        ) : (
          <IdeaCard
            idea={current}
            onJoin={onJoin ? () => onJoin(current) : undefined}
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={advance}
          disabled={exhausted}
        >
          Next idea
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
        <span className="text-[10px] tabular-nums text-[var(--cx-text-4)]">
          {seen}/{seenLimit} today
        </span>
      </div>
    </div>
  )
}
