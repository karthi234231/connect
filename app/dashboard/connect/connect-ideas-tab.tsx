'use client'

// Connect · Ideas tab — the idea VALIDATION loop.
//
// This is the "idea validation" surface: members validate (like) or pass on
// published ideas from the network, and can publish a new idea. It reuses the
// same domain actions the /dashboard/ideas pages use — nothing is mocked:
//   • validateIdeaAction  → the validate_idea RPC (like | pass | spark)
//   • submitIdeaAction     → creates a published idea
//   • listIdeasAction      → the published network pool (deck source)
//
// Anonymous identity: the deck never claims ownership; it shows a neutral
// "Connect member" author marker, exactly like /dashboard/ideas explore deck.
import { useCallback, useState } from 'react'
import { Lightbulb, Plus, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'

import {
  listIdeasAction,
  submitIdeaAction,
  validateIdeaAction,
  type IdeaListResult,
} from '@/app/actions/ideas'
import { queryClient, useQuery } from '@/client/query/client'
import { EmptyState, Button, Input, Textarea } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { IdeaCard, ideaCardToItem } from '@/components/ideas'
import { useLiveRegion } from '@/hooks/use-live-region'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type { IdeaCardDTO } from '@/services/ideas/idea.schema'

const IDEAS_KEY = ['connect', 'ideas', 'pool'].join('/')

export function ConnectIdeasTab() {
  const { polite: announce } = useLiveRegion()

  const { data, isLoading, error, refetch } = useQuery<IdeaListResult>(
    IDEAS_KEY,
    () => listIdeasAction(undefined, 30),
  )

  const ideas = data?.ideas ?? []

  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    problem: '',
    solution: '',
    ask: '',
  })
  const [posting, setPosting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const validate = useCallback(
    async (idea: IdeaCardDTO, action: 'like' | 'pass') => {
      if (busyId != null) return
      setBusyId(idea.id)
      try {
        await validateIdeaAction({ ideaId: idea.id, action })
        // Optimistically bump the local count so the card feels instant, then
        // refresh from the server (the source of truth for validationCount).
        const cached = queryClient.get<IdeaListResult>(IDEAS_KEY)
        if (cached && action === 'like') {
          queryClient.set<IdeaListResult>(IDEAS_KEY, {
            ...cached,
            ideas: cached.ideas.map((item) =>
              item.id === idea.id
                ? { ...item, validationCount: item.validationCount + 1 }
                : item,
            ),
          })
        }
        await refetch().catch(() => undefined)
        announce(
          action === 'like'
            ? `Validated ${idea.title}.`
            : `Passed on ${idea.title}.`,
        )
      } catch {
        showErrorToast('That could not be recorded. Please try again.')
        announce('Could not record that validation.')
      } finally {
        setBusyId(null)
      }
    },
    [announce, busyId, refetch],
  )

  async function publish(event: React.FormEvent) {
    event.preventDefault()
    if (posting) return
    setPosting(true)
    try {
      await submitIdeaAction({
        title: draft.title.trim(),
        problem: draft.problem.trim(),
        solution: draft.solution.trim(),
        ask: draft.ask.trim(),
        stage: 'idea',
        teamNeeded: [],
        tags: [],
        visibility: 'published',
        joinEnabled: true,
      })
      setDraft({ title: '', problem: '', solution: '', ask: '' })
      setComposerOpen(false)
      queryClient.invalidate(IDEAS_KEY)
      await refetch().catch(() => undefined)
      showSuccessToast('Idea published to the network')
      announce('Idea published.')
    } catch (err) {
      showErrorToast(
        err instanceof Error ? err.message : 'Could not publish idea.',
      )
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <section className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--cx-idea)]" />
            <h2 className="text-sm font-medium">Share an idea</h2>
          </div>
          <Button
            variant={composerOpen ? 'ghost' : 'secondary'}
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => setComposerOpen((open) => !open)}
          >
            {composerOpen ? 'Close' : 'New idea'}
          </Button>
        </div>

        {composerOpen ? (
          <form onSubmit={publish} className="mt-4 space-y-3">
            <Input
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              placeholder="Idea title"
              maxLength={120}
              required
            />
            <Textarea
              value={draft.problem}
              onChange={(e) =>
                setDraft((d) => ({ ...d, problem: e.target.value }))
              }
              placeholder="What problem are you solving?"
              rows={2}
              maxLength={1000}
              required
            />
            <Textarea
              value={draft.solution}
              onChange={(e) =>
                setDraft((d) => ({ ...d, solution: e.target.value }))
              }
              placeholder="Your proposed solution"
              rows={3}
              maxLength={2000}
              required
            />
            <Input
              value={draft.ask}
              onChange={(e) => setDraft((d) => ({ ...d, ask: e.target.value }))}
              placeholder="What do you need from the network?"
              maxLength={500}
              required
            />
            <Button
              type="submit"
              loading={posting}
              disabled={
                posting ||
                draft.title.trim().length < 3 ||
                draft.problem.trim().length < 10 ||
                draft.solution.trim().length < 10 ||
                draft.ask.trim().length < 3
              }
            >
              {posting ? 'Publishing…' : 'Publish idea'}
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
            Validate the ideas below, or publish one of your own to get feedback
            from your network.
          </p>
        )}
      </section>

      {/* Validation deck */}
      <section aria-label="Idea validation" className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-[var(--cx-idea)]" />
          <h2 className="text-sm font-medium">Validate network ideas</h2>
        </div>

        {isLoading ? (
          <LoadingState label="Loading ideas…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : ideas.length === 0 ? (
          <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
            <EmptyState
              icon={<Lightbulb className="size-7 text-[var(--cx-idea)]" />}
              title="No ideas to validate yet"
              description="Published ideas from your network will appear here."
            />
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            {/* Deck drives Next; the two buttons below record the verdict for
                the current card, then the deck advances. */}
            <IdeaValidationDeck
              ideas={ideas}
              busyId={busyId}
              onValidate={validate}
            />
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Deck + validation controls. Bespoke (rather than reusing IdeaDeck directly)
 * because the deck must expose the validated/passed verdict to the parent's
 * server call for the CURRENT card, while still advancing the queue.
 */
function IdeaValidationDeck({
  ideas,
  busyId,
  onValidate,
}: {
  ideas: IdeaCardDTO[]
  busyId: string | null
  onValidate: (idea: IdeaCardDTO, action: 'like' | 'pass') => Promise<void>
}) {
  const [index, setIndex] = useState(0)
  const current = ideas[index]

  const advance = () => setIndex((value) => value + 1)

  async function handle(action: 'like' | 'pass') {
    if (!current) return
    await onValidate(current, action)
    advance()
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        <EmptyState
          icon={<Sparkles className="size-7 text-[var(--cx-idea)]" />}
          title="You're all caught up"
          description="You've reviewed every idea in the pool. Check back later for more."
        />
      </div>
    )
  }

  const item = ideaCardToItem(current)
  const busy = busyId === current.id

  return (
    <div className="space-y-3">
      <IdeaCard idea={item} />
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<ThumbsDown className="size-3.5" />}
          disabled={busy}
          onClick={() => void handle('pass')}
        >
          Pass
        </Button>
        <span className="text-[10px] tabular-nums text-[var(--cx-text-4)]">
          {index + 1}/{ideas.length}
        </span>
        <Button
          size="sm"
          icon={<ThumbsUp className="size-3.5" />}
          disabled={busy}
          onClick={() => void handle('like')}
        >
          Validate
        </Button>
      </div>
    </div>
  )
}
