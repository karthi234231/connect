'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Chip,
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
  { value: 'idea', label: 'Idea (Initial Concept)' },
  { value: 'prototype', label: 'Prototype (Early Build)' },
  { value: 'mvp', label: 'MVP (Testing with Users)' },
  { value: 'launched', label: 'Launched (Live Product)' },
]

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'published', label: 'Published (Visible to Network)' },
  { value: 'draft', label: 'Draft (Private)' },
]

const POPULAR_SKILL_PRESETS = [
  'Frontend',
  'Backend',
  'Fullstack',
  'UI/UX Design',
  'AI / ML',
  'Co-Founder',
  'Mobile Dev',
  'Growth',
]

function FieldLabel({
  children,
  subtitle,
}: {
  children: ReactNode
  subtitle?: string
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
        {children}
      </span>
      {subtitle && (
        <span className="text-[10px] text-[var(--cx-text-4)]">{subtitle}</span>
      )}
    </div>
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
  const [joinEnabled, setJoinEnabled] = useState(initial?.joinEnabled ?? true)
  const [visibility, setVisibility] = useState(
    initial?.visibility ?? 'published',
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function toggleSkillPreset(skill: string) {
    const currentList = teamNeeded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (currentList.includes(skill)) {
      setTeamNeeded(currentList.filter((s) => s !== skill).join(', '))
    } else {
      setTeamNeeded([...currentList, skill].join(', '))
    }
  }

  async function handleSave() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // Ensure ask has a fallback default if blank
      const finalAsk = ask.trim() || 'Looking for co-builders and feedback'

      await onSubmit({
        title,
        problem,
        solution,
        ask: finalAsk,
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
    <Card className="border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <label className="block">
          <FieldLabel subtitle="Required">Title</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your concept or spark"
            disabled={isSubmitting}
            className="text-sm"
          />
        </label>

        <label className="block">
          <FieldLabel subtitle="Required (min 10 chars)">Target Problem</FieldLabel>
          <Textarea
            rows={3}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What specific problem or pain point are you solving?"
            disabled={isSubmitting}
            className="text-sm"
          />
        </label>

        <label className="block">
          <FieldLabel subtitle="Required (min 10 chars)">Proposed Solution</FieldLabel>
          <Textarea
            rows={3}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="How does your approach or product address this problem?"
            disabled={isSubmitting}
            className="text-sm"
          />
        </label>

        <label className="block">
          <FieldLabel subtitle="Required skills & team roles">Required Skills</FieldLabel>
          <Input
            value={teamNeeded}
            onChange={(e) => setTeamNeeded(e.target.value)}
            placeholder="e.g. React, UX Design, AI / ML, Co-Founder (comma-separated)"
            disabled={isSubmitting}
            className="text-sm mb-2"
          />
          {/* Skill Preset Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-[var(--cx-text-4)] mr-1">Quick Add:</span>
            {POPULAR_SKILL_PRESETS.map((skill) => {
              const active = teamNeeded
                .split(',')
                .map((s) => s.trim())
                .includes(skill)
              return (
                <Chip
                  key={skill}
                  active={active}
                  onClick={() => toggleSkillPreset(skill)}
                  className="cursor-pointer text-[10px] py-0.5 px-2"
                >
                  {active ? `✓ ${skill}` : `+ ${skill}`}
                </Chip>
              )
            })}
          </div>
        </label>

        <label className="block">
          <FieldLabel subtitle="Optional (e.g. feedback, co-founder)">What I Need (Ask)</FieldLabel>
          <Input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="e.g. Technical co-founder, design review, early beta testers"
            disabled={isSubmitting}
            className="text-sm"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <FieldLabel>Stage</FieldLabel>
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              disabled={isSubmitting}
              className="text-sm"
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
              placeholder="e.g. fintech, ai, developer-tools"
              disabled={isSubmitting}
              className="text-sm"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4 flex items-center justify-between">
          <div>
            <span className="block text-xs font-medium text-[var(--cx-text-1)]">
              Open to Collaborators & Join Requests
            </span>
            <span className="text-[11px] text-[var(--cx-text-3)]">
              Allow network members to apply to join your team
            </span>
          </div>
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
            className="text-sm"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        {submitError ? (
          <p className="text-xs text-[var(--cx-danger)] rounded-lg bg-[var(--cx-danger)]/10 p-3 border border-[var(--cx-danger)]/20">
            {submitError}
          </p>
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

