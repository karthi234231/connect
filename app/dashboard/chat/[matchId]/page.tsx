import { notFound } from 'next/navigation'
import { getThreadPeerAction } from '@/app/actions/chat'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import { ThreadView } from './thread-view'

interface ChatThreadPageProps {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: ChatThreadPageProps) {
  const { matchId } = await params
  const peer = await getThreadPeerAction({ matchId }).catch(() => null)

  if (!peer) {
    return { title: 'Chat not found' }
  }

  return { title: `Chat with ${peer.fullName}` }
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  const { matchId } = await params
  const [me, peer] = await Promise.all([
    getOwnProfileAction(),
    getThreadPeerAction({ matchId }).catch(() => null),
  ])

  if (!peer) notFound()

  return (
    <ThreadView
      matchId={matchId}
      myId={me?.id ?? ''}
      peer={peer}
    />
  )
}