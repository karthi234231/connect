'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/components/ui'
import { toErrorPayload } from '@/lib/errors'
import { cn } from '@/utils/cn'

export interface IdeaFormValues {
  title: string
  problem: string
  solution: string
  ask: string
  stage: string
  tags: string
  teamNeeded: string
  joinEnabled: boolean
  visibility: string
}

export interface IdeaFormProps {
  initial?: Partial<IdeaFormValues>
  submitLabel: string
  /** When set, a "Back" link is rendered and the save button is non-block. */
  cancelHref?: string
  onSubmit: (values: IdeaFormValues) => Promise<void>
}

const STAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'idea', label: 'Idea' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
  { value: 'launched', label: 'Launched' },
]

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
]

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
      {children}
    </span>
  )
}

export function IdeaForm({
  initial,
  submitLabel,
  cancelHref,
  onSubmit,
}: IdeaFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [problem, setProblem] = useState(initial?.problem ?? '')
  const [solution, setSolution] = useState(initial?.solution ?? '')
  const [ask, setAsk] = useState(initial?.ask ?? '')
  const [stage, setStage] = useState(initial?.stage ?? 'idea')
  const [tags, setTags] = useState(initial?.tags ?? '')
  const [teamNeeded, setTeamNeeded] = useState(initial?.teamNeeded ?? '')
  const [joinEnabled, setJoinEnabled] = useState(initial?.joinEnabled ?? false)
  const [visibility, setVisibility] = useState(
    initial?.visibility ?? 'published',
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSave() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        title,
        problem,
        solution,
        ask,
        stage,
        tags,
        teamNeeded,
        joinEnabled,
        visibility,
      })
    } catch (err) {
      setSubmitError(toErrorPayload(err).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <label className="block">
          <FieldLabel>Title</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your idea"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <FieldLabel>Problem</FieldLabel>
          <Textarea
            rows={3}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What problem are you solving?"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <FieldLabel>Solution</FieldLabel>
          <Textarea
            rows={3}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="How are you solving it?"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <FieldLabel>Ask</FieldLabel>
          <Input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="E.g. frontend co-founder, design feedback"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <FieldLabel>Stage</FieldLabel>
          <Select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            disabled={isSubmitting}
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <FieldLabel>Tags</FieldLabel>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Comma-separated, e.g. fintech, ai"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <FieldLabel>Team needed</FieldLabel>
          <Input
            value={teamNeeded}
            onChange={(e) => setTeamNeeded(e.target.value)}
            placeholder="Roles you're looking for, comma-separated"
            disabled={isSubmitting}
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--cx-text-2)]">
            Open join requests
          </span>
          <Switch
            checked={joinEnabled}
            onCheckedChange={setJoinEnabled}
            disabled={isSubmitting}
          />
        </div>

        <label className="block">
          <FieldLabel>Visibility</FieldLabel>
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            disabled={isSubmitting}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        {submitError ? (
          <p className="text-xs text-[var(--cx-danger)]">{submitError}</p>
        ) : null}
      </CardContent>

      <CardFooter
        className={cn(
          'border-t border-[var(--cx-border-1)] p-5',
          cancelHref ? 'justify-end gap-2' : 'justify-center',
        )}
      >
        {cancelHref ? (
          <Link href={cancelHref}>
            <Button variant="ghost" disabled={isSubmitting}>
              Back
            </Button>
          </Link>
        ) : null}
        <Button
          className={cancelHref ? undefined : 'w-full'}
          disabled={isSubmitting}
          onClick={handleSave}
        >
          {isSubmitting ? `${submitLabel}…` : submitLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
