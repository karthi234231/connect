'use client'

import type { ReactNode } from 'react'
import { Button, Input, Textarea } from '@/components/ui'
import { cn } from '@/utils/cn'

const DEFAULT_TOPICS = ['Design', 'Community', 'Technology', 'Career']

export interface PromptEditorProps {
  title: string
  onTitleChange: (value: string) => void
  text: string
  onTextChange: (value: string) => void
  topic: string
  onTopicChange: (value: string) => void
  topics?: string[]
  onPost?: () => void
  postLabel?: string
  className?: string
}

export function PromptEditor({
  title,
  onTitleChange,
  text,
  onTextChange,
  topic,
  onTopicChange,
  topics = DEFAULT_TOPICS,
  onPost,
  postLabel = 'Post',
  className,
}: PromptEditorProps): ReactNode {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 sm:p-5',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-12 size-36 rounded-full bg-[var(--cx-brand)]/15 blur-3xl"
      />
      <div className="relative">
        <h3 className="font-display text-xl leading-snug tracking-[-.02em]">
          Share with your network
        </h3>
        <p className="mt-1 text-xs text-[var(--cx-text-3)]">
          Post a prompt or challenge for people in your network to weigh in on.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="prompt-title" className="sr-only">
              Title
            </label>
            <Input
              id="prompt-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Give your post a title"
            />
          </div>
          <div>
            <label htmlFor="prompt-body" className="sr-only">
              Body
            </label>
            <Textarea
              id="prompt-body"
              rows={5}
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="What are you building, exploring, or stuck on?"
            />
          </div>
          <div>
            <label htmlFor="prompt-topic" className="sr-only">
              Topic
            </label>
            <select
              id="prompt-topic"
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              className="w-full cursor-pointer rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm text-[var(--cx-text-1)] outline-none focus:border-[var(--cx-brand)]"
            >
              {topics.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 pt-1">
          <p className="shrink-0 text-xs text-[var(--cx-text-4)]">
            Visible to your network
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onPost}
            className="bg-[var(--cx-brand)] text-white"
          >
            {postLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
