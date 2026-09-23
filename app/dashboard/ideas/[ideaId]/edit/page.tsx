'use client'

import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/states/LoadingState'
import { NotFoundState } from '@/components/states/NotFoundState'
import { getIdeaAction, updateIdeaAction } from '@/app/actions/ideas'
import { queryClient, useQuery } from '@/client/query/client'
import {
  ideaStageSchema,
  ideaVisibilitySchema,
  type IdeaDetailDTO,
} from '@/services/ideas/idea.schema'
import { Button } from '@/components/ui'
import { joinTagList, parseTagList } from '../../tag-utils'
import { IdeaForm } from '../../idea-form'

export default function EditIdeaPage() {
  const { ideaId } = useParams<{ ideaId: string }>()
  const router = useRouter()

  const detailKey = ['ideas', ideaId].join('/')

  const {
    data: idea,
    isLoading,
    error,
    refetch,
  } = useQuery<IdeaDetailDTO>(detailKey, () => getIdeaAction(ideaId))

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Ideas"
          title="Edit idea"
          description="Keep the thread going."
        />

        {isLoading ? (
          <LoadingState label="Loading idea…" />
        ) : error ? (
          <NotFoundState
            title="Idea not found"
            description="We couldn't load that idea."
            action={
              <Button variant="ghost" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : idea ? (
          <IdeaForm
            initial={{
              title: idea.title,
              problem: idea.problem,
              solution: idea.solution,
              ask: idea.ask,
              stage: idea.stage,
              tags: joinTagList(idea.tags),
              teamNeeded: joinTagList(idea.teamNeeded),
              joinEnabled: idea.joinEnabled,
              visibility: idea.visibility,
            }}
            submitLabel="Save changes"
            cancelHref={`/dashboard/ideas/${ideaId}`}
            onSubmit={async (values) => {
              await updateIdeaAction(ideaId, {
                title: values.title,
                problem: values.problem,
                solution: values.solution,
                ask: values.ask,
                stage: ideaStageSchema.parse(values.stage),
                teamNeeded: parseTagList(values.teamNeeded),
                tags: parseTagList(values.tags),
                joinEnabled: values.joinEnabled,
                visibility: ideaVisibilitySchema.parse(values.visibility),
              })
              queryClient.invalidate(detailKey)
              router.push(`/dashboard/ideas/${ideaId}`)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
