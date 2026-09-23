import { notFound } from 'next/navigation'
import { getMessagesAction, getThreadPeerAction } from '@/app/actions/chat'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import { ThreadView } from './thread-view'

interface ChatThreadPageProps {
  params: Promise<{ matchId: string }>
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  const { matchId } = await params
  const [page, me, peer] = await Promise.all([
    getMessagesAction({ matchId, limit: 50 }).catch(() => null),
    getOwnProfileAction(),
    getThreadPeerAction({ matchId }).catch(() => null),
  ])

  if (!page) notFound()

  return (
    <ThreadView
      matchId={matchId}
      myId={me?.id ?? ''}
      peer={peer ?? { fullName: '', role: null, avatarUrl: null }}
    />
  )
}
