'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Chip, EmptyState, Input, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { listIdeasAction, trackIdeaViewedAction } from '@/app/actions/ideas'
import {
  IdeaCard,
  IdeaDeck,
  IdeaRevisionDrawer,
  ideaCardToDeckItem,
  ideaCardToItem,
  stageLabel,
} from '@/components/ideas'
import { History, Lightbulb, Plus, Search, Sparkles, X } from 'lucide-react'

export default function IdeasPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [revisionIdea, setRevisionIdea] = useState<{ id: string; title: string } | null>(null)

  const { data, isLoading, error, refetch } = useQuery(
    keys.browse().join('/') + '/ideas',
    () => listIdeasAction({ own: true }),
  )
  const ideas = useMemo(() => data?.ideas ?? [], [data?.ideas])

  // Explore deck: the published network pool (own filter omitted)
  const exploreKey = keys.browse().join('/') + '/ideas/explore'
  const { data: explore } = useQuery(exploreKey, () => listIdeasAction())
  const exploreIdeas = (explore?.ideas ?? []).map(ideaCardToDeckItem)

  // Extract available categories (stages + tags) with counts for category pills
  const categoryPills = useMemo(() => {
    const counts = new Map<string, number>()
    
    ideas.forEach((i) => {
      const stage = stageLabel(i.stage)
      if (stage) {
        counts.set(stage, (counts.get(stage) ?? 0) + 1)
      }
      i.tags?.forEach((t) => {
        const formattedTag = t.charAt(0).toUpperCase() + t.slice(1)
        counts.set(formattedTag, (counts.get(formattedTag) ?? 0) + 1)
      })
    })

    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }))
  }, [ideas])

  const filteredIdeas = useMemo(() => {
    return ideas.filter((i) => {
      // Category filter check
      let matchesCategory = selectedCategory === 'all'
      if (!matchesCategory) {
        const stageMatch = stageLabel(i.stage).toLowerCase() === selectedCategory.toLowerCase()
        const tagMatch = i.tags?.some(
          (t) => t.toLowerCase() === selectedCategory.toLowerCase(),
        )
        matchesCategory = stageMatch || Boolean(tagMatch)
      }

      // Search query check
      if (!matchesCategory) return false
      if (!searchQuery.trim()) return true

      const q = searchQuery.toLowerCase().trim()
      return (
        i.title.toLowerCase().includes(q) ||
        i.problem.toLowerCase().includes(q) ||
        i.solution.toLowerCase().includes(q) ||
        i.stage.toLowerCase().includes(q) ||
        i.tags?.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [ideas, selectedCategory, searchQuery])

  const clearFilters = () => {
    setSelectedCategory('all')
    setSearchQuery('')
  }

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

        {/* Category Search & Filter Pills */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search concepts by keyword, tag, or stage…"
                aria-label="Search concepts"
                className="pl-9 pr-8"
              />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cx-text-4)]" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-4)] hover:text-[var(--cx-text-1)]"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {(selectedCategory !== 'all' || searchQuery.trim() !== '') && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {/* Interactive Filter Pills */}
          <div
            data-horizontal-scroll
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            <Chip
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
            >
              All concepts ({ideas.length})
            </Chip>
            {categoryPills.map(({ name, count }) => (
              <Chip
                key={name}
                active={selectedCategory.toLowerCase() === name.toLowerCase()}
                onClick={() => setSelectedCategory(name.toLowerCase())}
                className="cursor-pointer transition-all duration-200 hover:scale-105"
              >
                {name} ({count})
              </Chip>
            ))}
          </div>
        </div>

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
              title={selectedCategory === 'all' && !searchQuery ? 'No ideas yet' : 'No matching concepts'}
              description={
                selectedCategory === 'all' && !searchQuery
                  ? 'Capture the first spark and build something remarkable with aligned partners.'
                  : 'Try selecting a different filter pill or clearing search filters to explore other ideas.'
              }
              action={
                selectedCategory !== 'all' || searchQuery ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Link href="/dashboard/ideas/new">
                    <Button icon={<Plus className="size-4" />}>
                      Capture an idea
                    </Button>
                  </Link>
                )
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
                    <div className="flex w-full items-center gap-2">
                      <Link
                        href={`/dashboard/ideas/${idea.id}`}
                        className="flex-1 text-center rounded-xl bg-[var(--cx-brand)] px-3.5 py-2.5 text-xs font-medium text-white transition-all duration-200 hover:bg-[var(--cx-brand-strong)] hover:shadow-[0_4px_16px_rgba(208,164,91,0.25)] active:scale-[0.98]"
                      >
                        Open
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<History className="size-3.5" />}
                        onClick={() => setRevisionIdea({ id: idea.id, title: idea.title })}
                        title="View revision history"
                        aria-label={`View revision history for ${idea.title}`}
                      >
                        History
                      </Button>
                    </div>
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

        {/* Idea Revision History Drawer */}
        <IdeaRevisionDrawer
          ideaId={revisionIdea?.id ?? null}
          ideaTitle={revisionIdea?.title}
          open={Boolean(revisionIdea)}
          onOpenChange={(open) => {
            if (!open) setRevisionIdea(null)
          }}
        />
      </div>
    </div>
  )
}
