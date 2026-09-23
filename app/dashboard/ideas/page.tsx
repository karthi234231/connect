'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, EmptyState } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { listIdeasAction, trackIdeaViewedAction } from '@/app/actions/ideas'
import {
  IdeaCard,
  IdeaDeck,
  ideaCardToDeckItem,
  ideaCardToItem,
} from '@/components/ideas'
import { Lightbulb, Plus } from 'lucide-react'

export default function IdeasPage() {
  const router = useRouter()
  const { data, isLoading, error, refetch } = useQuery(
    keys.browse().join('/') + '/ideas',
    () => listIdeasAction({ own: true }),
  )
  const ideas = data?.ideas ?? []

  // Explore deck: the published network pool (own filter omitted) so nearby
  // idea cards can be swiped, exactly like the discover feed.
  const exploreKey = keys.browse().join('/') + '/ideas/explore'
  const { data: explore } = useQuery(exploreKey, () => listIdeasAction())
  const exploreIdeas = (explore?.ideas ?? []).map(ideaCardToDeckItem)

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Your ideas"
          description="Things you're noodling on."
          actions={
            <Link href="/dashboard/ideas/new">
              <Button icon={<Plus className="size-4" />}>New idea</Button>
            </Link>
          }
        />

        {isLoading ? (
          <LoadingState label="Loading ideas…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="size-8" />}
            title="No ideas yet"
            description="Capture the first spark and build from there."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={ideaCardToItem(idea)}
                footerAction={
                  <Link
                    href={`/dashboard/ideas/${idea.id}`}
                    className="flex w-full items-center justify-between rounded-xl bg-[var(--cx-brand)] px-3 py-2.5 text-xs font-medium text-white transition hover:bg-[var(--cx-brand-strong)]"
                  >
                    Open
                  </Link>
                }
              />
            ))}
          </div>
        )}

        {exploreIdeas.length > 0 && (
          <section
            aria-label="Explore ideas"
            className="mt-10 border-t border-[var(--cx-border-1)] pt-8"
          >
            <div className="mb-4">
              <h2 className="font-display text-lg font-medium tracking-[-.02em]">
                Explore ideas
              </h2>
              <p className="mt-1 text-xs text-[var(--cx-text-3)]">
                Swipe through published ideas from your network.
              </p>
            </div>
            <div className="mx-auto max-w-md">
              <IdeaDeck
                ideas={exploreIdeas}
                onJoin={(idea) => router.push(`/dashboard/ideas/${idea.id}`)}
                onSwipe={(idea) => {
                  void trackIdeaViewedAction(idea.id)
                }}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
