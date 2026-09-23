'use client'

import type { ReactNode } from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ReactionBarProps {
  likes: number
  replies: number
  liked?: boolean
  onLike?: () => void
  onReply?: () => void
  className?: string
}

export function ReactionBar({
  likes,
  replies,
  liked = false,
  onLike,
  onReply,
  className,
}: ReactionBarProps): ReactNode {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={onLike}
        aria-pressed={liked}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
          liked &&
            'text-[var(--cx-danger)] hover:bg-[var(--cx-danger-soft)] hover:text-[var(--cx-danger)]',
        )}
      >
        <Heart
          className={cn('size-4', liked && 'fill-current')}
          aria-hidden="true"
        />
        <span className="text-xs font-medium tabular-nums">{likes}</span>
      </button>
      <button
        type="button"
        onClick={onReply}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium">{replies} replies</span>
      </button>
    </div>
  )
}
