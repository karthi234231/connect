'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Chip, EmptyState, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { listIdeasAction, trackIdeaViewedAction } from '@/app/actions/ideas'
import {
  IdeaCard,
  IdeaDeck,
  ideaCardToDeckItem,
  ideaCardToItem,
} from '@/components/ideas'
import { Lightbulb, Plus, Sparkles } from 'lucide-react'

export default function IdeasPage() {
  const router = useRouter()
  const [selectedTag, setSelectedTag] = useState<string>('all')

  const { data, isLoading, error, refetch } = useQuery(
    keys.browse().join('/') + '/ideas',
    () => listIdeasAction({ own: true }),
  )
  const ideas = useMemo(() => data?.ideas ?? [], [data?.ideas])

  // Explore deck: the published network pool (own filter omitted)
  const exploreKey = keys.browse().join('/') + '/ideas/explore'
  const { data: explore } = useQuery(exploreKey, () => listIdeasAction())
  const exploreIdeas = (explore?.ideas ?? []).map(ideaCardToDeckItem)

  // Extract available tags for filter pills
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    ideas.forEach((i) => {
      i.tags?.forEach((t) => tagSet.add(t))
    })
    return Array.from(tagSet)
  }, [ideas])

  const filteredIdeas = useMemo(() => {
    if (selectedTag === 'all') return ideas
    return ideas.filter((i) =>
      i.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase()),
    )
  }, [ideas, selectedTag])

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Sparks & Concepts"
          title="Your ideas"
          description="Things you're noodling on and building with your network."
          actions={
            <div className="flex items-center gap-3">
              <Badge variant="brand" pulse>
                <Sparkles className="size-3" />
                {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}
              </Badge>
              <Link href="/dashboard/ideas/new">
                <Button icon={<Plus className="size-4" />}>New idea</Button>
              </Link>
            </div>
          }
        />

        {/* Category Filter Pills */}
        {availableTags.length > 0 && (
          <div
            data-horizontal-scroll
            className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"
          >
            <Chip
              active={selectedTag === 'all'}
              onClick={() => setSelectedTag('all')}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
            >
              All concepts ({ideas.length})
            </Chip>
            {availableTags.map((tag) => (
              <Chip
                key={tag}
                active={selectedTag.toLowerCase() === tag.toLowerCase()}
                onClick={() => setSelectedTag(tag.toLowerCase())}
                className="cursor-pointer transition-all duration-200 hover:scale-105 capitalize"
              >
                {tag}
              </Chip>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="cx-glass-card rounded-[24px] p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filteredIdeas.length === 0 ? (
          <div className="cx-glass-card rounded-[28px] p-8 text-center">
            <EmptyState
              icon={<Lightbulb className="size-8 text-[var(--cx-brand)]" />}
              title={selectedTag === 'all' ? 'No ideas yet' : 'No matching concepts'}
              description={
                selectedTag === 'all'
                  ? 'Capture the first spark and build something remarkable with aligned partners.'
                  : 'Try selecting a different filter pill to explore other ideas.'
              }
              action={
                <Link href="/dashboard/ideas/new">
                  <Button icon={<Plus className="size-4" />}>
                    Capture an idea
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIdeas.map((idea, index) => (
              <div
                key={idea.id}
                className="cx-fade-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <IdeaCard
                  idea={ideaCardToItem(idea)}
                  footerAction={
                    <Link
                      href={`/dashboard/ideas/${idea.id}`}
                      className="flex w-full items-center justify-between rounded-xl bg-[var(--cx-brand)] px-3.5 py-2.5 text-xs font-medium text-white transition-all duration-200 hover:bg-[var(--cx-brand-strong)] hover:shadow-[0_4px_16px_rgba(208,164,91,0.25)] active:scale-[0.98]"
                    >
                      Open
                    </Link>
                  }
                />
              </div>
            ))}
          </div>
        )}

        {exploreIdeas.length > 0 && (
          <section
            aria-label="Explore ideas"
            className="mt-12 border-t border-[var(--cx-border-1)] pt-8"
          >
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-[-.02em] text-[var(--cx-text-1)]">
                Explore network ideas
              </h2>
              <p className="mt-1 text-xs text-[var(--cx-text-3)]">
                Swipe through published ideas from your network to collaborate.
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
