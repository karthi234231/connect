'use client'

import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Idea } from './idea'

export interface IdeaCardProps {
  idea: Idea
  onJoin?: (idea: Idea) => void
  footerMeta?: string
  footerAction?: ReactNode
}

export function IdeaCard({
  idea,
  onJoin,
  footerMeta,
  footerAction,
}: IdeaCardProps): ReactNode {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[var(--cx-surface-1)] p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-12 size-36 rounded-full bg-[var(--cx-brand)]/15 blur-3xl"
      />
      <div className="relative flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
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
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl leading-snug tracking-[-.025em]">
            {idea.title}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
              <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--cx-text-4)]">
                Problem
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--cx-text-2)]">
                {idea.problem}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
              <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--cx-text-4)]">
                Approach
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--cx-text-2)]">
                {idea.approach}
              </p>
            </div>
          </div>
          <p className="text-xs leading-5 text-[var(--cx-text-3)]">
            {idea.meta}
          </p>
        </div>
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
          <span className="shrink-0 text-[11px] text-[var(--cx-text-4)]">
            Today
          </span>
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
  )
}
