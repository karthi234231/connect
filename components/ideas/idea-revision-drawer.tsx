'use client'

import { useQuery } from '@/client/query/client'
import { getIdeaRevisionsAction, type IdeaRevisionDTO } from '@/app/actions/ideas'
import { Sheet } from '@/components/ui/sheet'
import { Badge, Chip, EmptyState } from '@/components/ui'
import { LoadingState } from '@/components/states/LoadingState'
import { History, GitCommit, Calendar, Tag, Users } from 'lucide-react'

export interface IdeaRevisionDrawerProps {
  ideaId: string | null
  ideaTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function IdeaRevisionDrawer({
  ideaId,
  ideaTitle,
  open,
  onOpenChange,
}: IdeaRevisionDrawerProps) {
  const queryKey = ideaId ? `ideas/${ideaId}/revisions` : null

  const { data: revisions = [], isLoading, error } = useQuery<IdeaRevisionDTO[]>(
    queryKey ?? 'disabled-revisions',
    () => (ideaId ? getIdeaRevisionsAction(ideaId) : Promise.resolve([])),
  )

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      label="Revision history"
      header={
        <div className="flex items-center gap-2">
          <History className="size-5 text-[var(--cx-brand)]" />
          <span>Revision History</span>
        </div>
      }
    >
      <div className="space-y-4">
        {ideaTitle ? (
          <div className="rounded-xl bg-[var(--cx-surface-2)] p-3 border border-[var(--cx-border-1)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cx-text-4)]">
              Concept
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--cx-text-1)]">
              {ideaTitle}
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <LoadingState label="Fetching edit history…" />
        ) : error ? (
          <div className="rounded-xl border border-[var(--cx-danger)]/20 bg-[var(--cx-danger)]/10 p-4 text-xs text-[var(--cx-danger)]">
            Unable to load revision history.
          </div>
        ) : revisions.length === 0 ? (
          <EmptyState
            icon={<GitCommit className="size-8 text-[var(--cx-text-3)]" />}
            title="No revisions recorded yet"
            description="Revisions are saved automatically whenever changes are made to this idea."
          />
        ) : (
          <div className="relative pl-4 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--cx-border-1)]">
            {revisions.map((rev, idx) => (
              <div key={rev.id || rev.revisionNumber} className="relative group">
                <span className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-[var(--cx-surface-1)] bg-[var(--cx-brand)] shadow-sm" />
                <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4 space-y-3 transition hover:border-[var(--cx-brand)]/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="brand" className="font-mono text-xs">
                        v{rev.revisionNumber}
                      </Badge>
                      {idx === 0 && (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-[var(--cx-text-3)]">
                      <Calendar className="size-3" />
                      {formatDate(rev.createdAt)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-display text-base font-semibold text-[var(--cx-text-1)]">
                      {rev.title}
                    </h4>
                    <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-brand-strong)]">
                      Stage: {rev.stage}
                    </span>
                  </div>

                  <div className="grid gap-2 text-xs">
                    {rev.problem && (
                      <div className="rounded-lg bg-[var(--cx-surface-2)] p-2.5">
                        <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--cx-text-4)]">
                          Problem
                        </span>
                        <p className="mt-0.5 text-[var(--cx-text-2)]">{rev.problem}</p>
                      </div>
                    )}

                    {rev.solution && (
                      <div className="rounded-lg bg-[var(--cx-surface-2)] p-2.5">
                        <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--cx-text-4)]">
                          Solution
                        </span>
                        <p className="mt-0.5 text-[var(--cx-text-2)]">{rev.solution}</p>
                      </div>
                    )}
                  </div>

                  {rev.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <Tag className="size-3 text-[var(--cx-text-4)]" />
                      {rev.tags.map((t) => (
                        <Chip key={t} className="text-[10px] py-0.5 px-2">
                          {t}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {rev.teamNeeded.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Users className="size-3 text-[var(--cx-text-4)]" />
                      {rev.teamNeeded.map((team) => (
                        <Chip key={team} active className="text-[10px] py-0.5 px-2">
                          {team}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
