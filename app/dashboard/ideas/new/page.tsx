'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { submitIdeaAction } from '@/app/actions/ideas'
import {
  ideaStageSchema,
  ideaVisibilitySchema,
} from '@/services/ideas/idea.schema'
import { parseTagList } from '../tag-utils'
import { IdeaForm } from '../idea-form'

export default function NewIdeaPage() {
  const router = useRouter()

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Ideas"
          title="New idea"
          description="Capture the spark while it's warm."
        />

        <IdeaForm
          submitLabel="Publish idea"
          onSubmit={async (values) => {
            const created = await submitIdeaAction({
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
            router.push(`/dashboard/ideas/${created.ideaId}`)
          }}
        />
      </div>
    </div>
  )
}
